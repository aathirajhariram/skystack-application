# SkyStack - flow, access model and setup

## The customer journey
1. **Subscribe** - a visitor clicks **Subscribe** on the website (or on the login page) and picks **Basic / Pro / Elite**
   in a popup, entering company, name, work email and industry. Prices and features come from `cfg.Plan`
   (edit with a plain `UPDATE`, no deployment). The seeded prices are placeholders.
2. **Two emails are sent automatically**
   - to **SkyStack's business inbox** (`SKY_BUSINESS_EMAIL`): the customer's login email, name, company, industry, plan;
   - to the **customer**: a secure Stripe payment link (valid 24 h; submitting the form again sends a fresh one).
3. **Payment received** - Stripe calls our webhook; the request becomes `PAID` and the business inbox is told.
4. **Activation (automatic)** - the activation worker creates the client's database, configuration from the industry
   template, upload folders and dashboard tiles, then **emails the customer a one-time password** for the login email
   they registered. Failures mark the request `ACTIVATION_FAILED`, alert the business inbox, and can be retried from Ops.
5. **Discovery call (you)** - schedule the call, collect sample data, then refine that client's `cfg.*` rows
   (ColumnMapping, ValidationRule, ThresholdRule, DashboardTile ...). Until then the industry template applies.
6. **First sign-in** - email + one-time password, forced to choose a new password (stored as a new version of the
   user's secret in the **viewers** Key Vault). Users can change it any time under **Account**.
7. **Admin tab** - admins re-enter their password to open it (step-up, 10 min). They invite employees as
   *Administrator*, *Uploader* (dashboards + uploads) or *Viewer* (dashboards only), enable/disable people, reset
   passwords, and choose **per employee which dashboards they may see** (**Dashboards** button). The plan's user limit is enforced.
8. **Upload -> dashboard** - uploads land in ADLS `landing/<client>/<source>/`; a storage event starts Data Factory,
   which runs the Databricks framework and loads the client's own database; the portal draws the client's own dashboard.
9. **Switch off** - `/ops` > Disable stops that client's sign-ins and pipelines.

## The two Key Vaults
| Vault | Holds | Written by |
|---|---|---|
| **Viewers** (`SKY_VIEWERS_VAULT_URL`) | each portal user's password **hash** (`pw-<UserId>`); every change is a new secret version | Customer API (when a user sets/changes a password), Ops/worker (one-time passwords) |
| **Developers** (`SKY_DEVELOPERS_VAULT_URL`) | JWT signing key, SMTP, Stripe keys, client database credentials, API ids | developers / Ops only; the customer API can only **read** it |

Developers secrets to create: `portal-jwt-signing-key`, `smtp-host`, `smtp-port`, `smtp-user`, `smtp-password`,
`smtp-from`, `stripe-secret-key`, `stripe-webhook-secret`, `control-db-user`, `control-db-password`.
Client database credentials (`target-<client>-sql`) are created automatically at activation.

## Who is controlled by what
| Who | Controlled by |
|---|---|
| SkyStack staff (Ops console, manual onboarding, retry) | **Microsoft Entra ID app role `Platform.Admin`** - assign/remove people in Azure |
| Customer API / Ops+worker / Databricks / ADF | **Azure RBAC on managed identities** (below) |
| Client administrator / uploader / viewer + per-dashboard visibility | **Portal roles** in the control DB, enforced by the API on every request |

Client employees have no Azure accounts, so Azure RBAC cannot express "viewer of client X". Azure RBAC limits what the
*application itself* may touch; the portal roles limit what each *person* may do.

## Deployments (same image `portal_auth/Dockerfile`)
| Deployment | Command / env | Exposed to internet? |
|---|---|---|
| Customer API | default `uvicorn`, `SKY_ENABLE_OPS=false` - serves login, portal, admin, **/public/plans, /public/subscribe, /public/webhooks/stripe** | yes |
| Ops API | `SKY_ENABLE_OPS=true` - Entra-protected `/ops/*` | restrict to staff network if possible |
| Activation worker | `python -m app.worker` (same env as Ops, privileged identity) | no (no inbound traffic) |

The privileged identity (can create databases and write the developers vault) is **never** used by an internet-facing endpoint:
the public webhook only marks a request `PAID`; the private worker does the activation.

## Azure role assignments
| Identity | Resource | Role |
|---|---|---|
| Customer API | viewers vault | Key Vault Secrets Officer |
| Customer API | developers vault | Key Vault Secrets User (read-only) |
| Customer API | storage account | Storage Blob Data Contributor |
| Customer API | control DB | `sql/06_security/001_grants.sql` |
| Ops API + worker | developers vault, viewers vault | Key Vault Secrets Officer |
| Ops API + worker | storage account | Storage Blob Data Contributor |
| Ops API + worker | SQL server | Entra admin of the server + Contributor on its resource group |
| Data Factory | Databricks, control DB, storage (Event Grid for the upload trigger) | Contributor / DB user / Storage Blob Data Reader |

## Stripe setup
1. Create the Stripe account, copy the secret key into the developers vault as `stripe-secret-key`.
2. Add a webhook endpoint `https://api.skystack.global/public/webhooks/stripe`, event **checkout.session.completed**;
   store its signing secret as `stripe-webhook-secret`.
3. Test with Stripe test mode and test card 4242 4242 4242 4242 before going live.
(Another provider can be swapped in by replacing `app/services/billing.py`.)

## Deploy order
1. SQL: `01_tables` -> `02_views` -> `03_procedures` -> `05_templates` -> `06_security`.
2. Key Vaults, secrets, storage containers (`landing, archive, bronze, silver, gold`), Databricks, Data Factory (`adf/`), per the role table.
3. Deploy Customer API, Ops API, worker; set `.env.example` values as app settings.
4. Frontend: `npm install && npm run build`, set `VITE_API_URL` (and the `/ops` Entra variables), host with the API on the same registrable domain (cookie is SameSite=Lax).

## Known limits
- Plan features beyond **user count** are shown to customers but are not yet enforced in code (source count, refresh frequency).
- Clients must upload with the **template's column names** until their config is tailored after the discovery call.
- The subscribe rate limiter is in-memory per instance (add Front Door/Redis if you scale out). If the API sits behind a proxy, make sure it forwards the real client IP.
- Dashboards read **Azure SQL** targets only. No self-service "forgot password": the admin or SkyStack resets it.
- A payment that arrives for an email that already has an account is not auto-activated; it shows up as `ACTIVATION_FAILED` in Ops.

## Front-end notes
- Cookie banner: shown on first visit; choosing Accept / Reject / Save closes it for good (stored in the browser). No floating button stays on screen; visitors reopen it from the footer link **Cookie settings**.
- Subscribe popup: three plan cards (Basic / Pro / Elite) with a Subscribe button each, then a short details form.
- Images: original SkyStack illustrations in `frontend/public/img` (one per industry, expertise area, article and page). Regenerate or replace the files to change them.

## Production in one pass
`deploy/azure_deploy.sh` creates the Azure resources (storage, SQL, both Key Vaults, identities and roles, Data Factory, Databricks, registry, the three Container Apps). Edit the names at the top, run it, then follow the guide for the parts that cannot be scripted: SQL scripts, remaining secrets, Databricks scope, Data Factory import, Stripe, Entra app, domains, frontend hosting.
