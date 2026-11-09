#!/usr/bin/env bash
# SkyStack - create the Azure foundation in one pass (guide sections 3, 5, 6, 8.1 and 11).
# Run from the project root:  bash deploy/azure_deploy.sh
# Needs: Azure CLI logged in (az login), Owner on the subscription, Docker NOT required (images are built in Azure).
# Not yet run against a real subscription: read it once, run it step by step, fix names that already exist.
set -euo pipefail

# ---- 1. EDIT THESE ----------------------------------------------------------------------------
SUBSCRIPTION="<subscription id>"
LOC="westeurope"
RG="rg-skystack-prod"
SA="skystackdata01"                 # globally unique, lowercase letters and digits
SQLSRV="sql-skystack"               # globally unique
SQLADMIN_USER="skyadmin"
SQLADMIN_PASS="<long random password>"
ENTRA_ADMIN_UPN="<your Entra user principal name>"
ENTRA_ADMIN_OID="<your Entra object id>"
KV_VIEW="kv-skystack-viewers"       # globally unique
KV_DEV="kv-skystack-developers"     # globally unique
ADF="adf-skystack"
ACR="skystackacr"                   # globally unique, lowercase letters and digits
CAE="cae-skystack"
DBW="dbw-skystack"
BUSINESS_EMAIL="billing@skystack.global"
SITE="https://www.skystack.global"
# -----------------------------------------------------------------------------------------------

az account set --subscription "$SUBSCRIPTION"
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.EventGrid --wait
az extension add --name containerapp --upgrade -y

echo "== Resource group, storage, containers"
az group create -n "$RG" -l "$LOC"
az storage account create -n "$SA" -g "$RG" -l "$LOC" --sku Standard_LRS --kind StorageV2 --hns true \
  --min-tls-version TLS1_2 --allow-blob-public-access false
for c in landing archive bronze silver gold; do
  az storage container create --account-name "$SA" --name "$c" --auth-mode login
done

echo "== SQL server and control database"
az sql server create -n "$SQLSRV" -g "$RG" -l "$LOC" --admin-user "$SQLADMIN_USER" --admin-password "$SQLADMIN_PASS"
az sql server ad-admin create -g "$RG" -s "$SQLSRV" -u "$ENTRA_ADMIN_UPN" -i "$ENTRA_ADMIN_OID"
az sql db create -g "$RG" -s "$SQLSRV" -n skystack_control --service-objective S0
az sql server firewall-rule create -g "$RG" -s "$SQLSRV" -n allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

echo "== Key Vaults (RBAC mode)"
az keyvault create -n "$KV_VIEW" -g "$RG" -l "$LOC" --enable-rbac-authorization true --enable-purge-protection true
az keyvault create -n "$KV_DEV"  -g "$RG" -l "$LOC" --enable-rbac-authorization true --enable-purge-protection true
ME=$(az ad signed-in-user show --query id -o tsv)
DEV_ID=$(az keyvault show -n "$KV_DEV" --query id -o tsv)
VIEW_ID=$(az keyvault show -n "$KV_VIEW" --query id -o tsv)
az role assignment create --assignee "$ME" --role "Key Vault Secrets Officer" --scope "$DEV_ID"
sleep 30   # role assignments need a moment before they work
az keyvault secret set --vault-name "$KV_DEV" --name portal-jwt-signing-key --value "$(openssl rand -base64 48)" >/dev/null
echo "   -> still add by hand: smtp-host, smtp-port, smtp-user, smtp-password, smtp-from, stripe-secret-key,"
echo "      stripe-webhook-secret, control-db-user, control-db-password   (guide sections 5, 7 and 9)"

echo "== Identities and roles"
az identity create -g "$RG" -n skystack-api >/dev/null
az identity create -g "$RG" -n skystack-ops >/dev/null
API=$(az identity show -g "$RG" -n skystack-api --query principalId -o tsv)
OPS=$(az identity show -g "$RG" -n skystack-ops --query principalId -o tsv)
SA_ID=$(az storage account show -n "$SA" --query id -o tsv)
RG_ID=$(az group show -n "$RG" --query id -o tsv)
sleep 20
az role assignment create --assignee-object-id "$API" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets Officer" --scope "$VIEW_ID"
az role assignment create --assignee-object-id "$API" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User"    --scope "$DEV_ID"
az role assignment create --assignee-object-id "$API" --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope "$SA_ID"
az role assignment create --assignee-object-id "$OPS" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets Officer" --scope "$VIEW_ID"
az role assignment create --assignee-object-id "$OPS" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets Officer" --scope "$DEV_ID"
az role assignment create --assignee-object-id "$OPS" --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope "$SA_ID"
az role assignment create --assignee-object-id "$OPS" --assignee-principal-type ServicePrincipal --role Contributor --scope "$RG_ID"

echo "== Data Factory"
az datafactory create -g "$RG" -n "$ADF" -l "$LOC"
ADF_OID=$(az datafactory show -g "$RG" -n "$ADF" --query identity.principalId -o tsv)
az role assignment create --assignee-object-id "$ADF_OID" --assignee-principal-type ServicePrincipal --role "Storage Blob Data Reader" --scope "$SA_ID"

echo "== Databricks workspace (Premium)"
az extension add --name databricks -y
az databricks workspace create -g "$RG" -n "$DBW" -l "$LOC" --sku premium

echo "== Container registry, image build, Container Apps environment"
az acr create -g "$RG" -n "$ACR" --sku Basic
az acr build -r "$ACR" -t skystack-portal:1 portal_auth/
az containerapp env create -g "$RG" -n "$CAE" -l "$LOC"

API_ID=$(az identity show -g "$RG" -n skystack-api --query id -o tsv)
API_CLIENT=$(az identity show -g "$RG" -n skystack-api --query clientId -o tsv)
OPS_ID=$(az identity show -g "$RG" -n skystack-ops --query id -o tsv)
OPS_CLIENT=$(az identity show -g "$RG" -n skystack-ops --query clientId -o tsv)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)
az role assignment create --assignee-object-id "$API" --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"
az role assignment create --assignee-object-id "$OPS" --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"
sleep 30

COMMON=(SKY_VIEWERS_VAULT_URL=https://$KV_VIEW.vault.azure.net/ SKY_DEVELOPERS_VAULT_URL=https://$KV_DEV.vault.azure.net/
        SKY_CONTROL_DB_SERVER=$SQLSRV.database.windows.net SKY_CONTROL_DB_NAME=skystack_control
        SKY_STORAGE_ACCOUNT=$SA SKY_BUSINESS_EMAIL=$BUSINESS_EMAIL SKY_PORTAL_BASE_URL=$SITE
        "SKY_CORS_ORIGINS=[\"$SITE\"]" SKY_COOKIE_SECURE=true)

echo "== Customer API (public, one replica)"
az containerapp create -g "$RG" -n ca-skystack-api --environment "$CAE" \
  --image "$ACR.azurecr.io/skystack-portal:1" --target-port 8000 --ingress external \
  --registry-server "$ACR.azurecr.io" --registry-identity "$API_ID" --user-assigned "$API_ID" \
  --min-replicas 1 --max-replicas 1 --cpu 0.5 --memory 1Gi \
  --env-vars AZURE_CLIENT_ID="$API_CLIENT" SKY_ENABLE_OPS=false "${COMMON[@]}"

OPSVARS=(AZURE_CLIENT_ID="$OPS_CLIENT" SKY_ENABLE_OPS=true "${COMMON[@]}"
  SKY_ENTRA_TENANT_ID="<tenant id>" SKY_ENTRA_AUDIENCE="api://<ops app client id>"
  SKY_PROVISION_DB=true SKY_TARGET_SQL_SERVER_NAME=$SQLSRV SKY_TARGET_SQL_SERVER_FQDN=$SQLSRV.database.windows.net
  SKY_SUBSCRIPTION_ID="$SUBSCRIPTION" SKY_RESOURCE_GROUP="$RG" SKY_API_IDENTITY_NAME=skystack-api)

echo "== Ops API"
az containerapp create -g "$RG" -n ca-skystack-ops --environment "$CAE" \
  --image "$ACR.azurecr.io/skystack-portal:1" --target-port 8000 --ingress external \
  --registry-server "$ACR.azurecr.io" --registry-identity "$OPS_ID" --user-assigned "$OPS_ID" \
  --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi --env-vars "${OPSVARS[@]}"

echo "== Activation worker (no ingress)"
az containerapp create -g "$RG" -n ca-skystack-worker --environment "$CAE" \
  --image "$ACR.azurecr.io/skystack-portal:1" \
  --registry-server "$ACR.azurecr.io" --registry-identity "$OPS_ID" --user-assigned "$OPS_ID" \
  --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi \
  --command python --args "-m" "app.worker" --env-vars "${OPSVARS[@]}"

echo
echo "DONE. API address:  https://$(az containerapp show -g "$RG" -n ca-skystack-api --query properties.configuration.ingress.fqdn -o tsv)"
echo "Next: run the SQL scripts, add the remaining secrets, create the Databricks scope, import the ADF files,"
echo "      attach api.skystack.global, then build the frontend (guide sections 4, 5, 7, 8, 11.3, 12)."
