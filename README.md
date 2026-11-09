# SkyStack platform

> **Start with `docs/SETUP.md`** (flow, access model, Azure setup). `frontend/` is the website with the client workspace; `portal_auth/` is the API.

Config-driven data platform for client file feeds (Excel / CSV / JSON / ERP exports) with a per-client portal.

```
skystack-platform/
├── frontend/                    the SkyStack website (React + Vite) incl. /login, client workspace, /ops staff console
├── portal_auth/                 API (FastAPI): sign-in, password change, admin/roles, uploads, dashboards, Ops onboarding
├── docs/SETUP.md                customer journey, Key Vaults, access model, Stripe + Azure setup
├── sql/                         Control DB (Azure SQL) - run in folder/file order
│   ├── 01_tables/               cfg.* (configuration) and audit.* (history)
│   ├── 02_views/                what the framework and dashboards read
│   ├── 03_procedures/           run lifecycle + ADF lookups + housekeeping
│   └── 04_seed/                 example client (logistics / CSV / Azure SQL)
├── adf/                         pipeline + schedule triggers (daily / weekly / monthly)
└── databricks/
    ├── notebooks/run_pipeline.py        entry point called by ADF
    └── framework/skyframe/
        ├── config/       settings, models, config_reader
        ├── extraction/   csv, excel, json, xml, fixed_width, erp_tally, erp_sap + factory
        ├── ingestion/    file checks (duplicates, empty, missing columns, min rows)
        ├── cleansing/    cleaners, type_casting
        ├── validation/   rules + engine (reject vs warn)
        ├── scd/          SCD 0 / 1 / 2 on Delta
        ├── layers/       bronze, silver, gold
        ├── quality/      metrics, threshold_checker, reconciliation
        ├── writers/      azure sql, cosmos, delta + factory
        ├── alerts/       email_alert
        ├── pipeline/     pipeline_runner (orchestration)
        └── utils/        secrets, paths, jdbc, control_db, audit_writer, file_io, logger
```

## Flow
Portal upload -> `landing/<client>/<source>/` (ADLS) -> ADF trigger -> `cfg.usp_GetPendingSources` -> per source:
`audit.usp_StartRun` -> Databricks notebook -> `audit.usp_EndRun` / `audit.usp_FailRun`.

Inside the notebook: ingestion checks -> **bronze** (raw) -> cleanse/type/validate -> threshold gate ->
**silver** (SCD) + quarantine for rejected rows -> **gold** -> client DB (Azure SQL / Cosmos / Delta) -> reconciliation -> audit -> archive -> e-mail.

## Setup order
1. Control DB: run `sql/01_tables`, `02_views`, `03_procedures` (then edit/run the seed).
2. Key Vault secrets (names are in `config/settings.py`): `control-db-user`, `control-db-password`,
   `smtp-host/port/user/password/from`, one credential secret per client target (e.g. `target-demo-logistics-sql`
   = `{"user":"..","password":".."}`; Cosmos = `{"key":".."}`).
3. Databricks: create a **Key Vault-backed secret scope** (`skystack-kv`), set cluster env vars
   `SKY_STORAGE_ACCOUNT`, `SKY_CONTROL_DB_SERVER`, `SKY_CONTROL_DB_NAME`, grant the cluster access to ADLS
   (Unity Catalog external locations or a service principal), install `openpyxl` (+ Cosmos connector if needed).
   Use a single-user / dedicated cluster.
4. ADLS containers: `landing, archive, bronze, silver, gold`.
5. ADF: create linked services `ls_control_sql`, `ls_databricks`, dataset `ds_control_sql`, import pipeline + triggers.
6. Portal: `pip install -r portal_auth/requirements.txt`, copy `.env.example` to `.env`, run `scripts/generate_jwt_key.py`,
   then `scripts/provision_client_user.py` for each client user, then `uvicorn app.main:app`.

## Onboarding a new client / industry (no code change)
Insert rows into `cfg.Client`, `cfg.TargetConnection`, `cfg.Source`, `cfg.ColumnMapping`, optionally
`cfg.ValidationRule`, `cfg.ThresholdRule`, `cfg.ReconciliationRule`, `cfg.AlertRecipient` - see `sql/04_seed`.
New file type: add one extractor class and register it in `extraction/extractor_factory.py`
(and add the name to the CHECK constraint on `cfg.Source.FileFormat`).

## Key Vault access (portal)
- Portal runtime identity (Managed Identity): role **Key Vault Secrets User** only.
- Whoever runs `provision_client_user.py`: **Key Vault Secrets Officer**.
- Passwords are never stored: each login secret holds an Argon2 hash.

## Notes / behaviours to know
- Threshold severity `ERROR` blocks the load (files go to `archive/rejected/...`); `WARN` loads and e-mails.
- `WriteMode APPEND` publishes this batch's valid rows; `OVERWRITE` publishes the full current silver snapshot.
- For SCD 1/2 the business key must be unique per batch; duplicate keys are quarantined (both rows).
- ADF: a failed notebook is recorded via `usp_FailRun` and the failure branch succeeds, so alert on `audit.PipelineRun.Status='FAILED'` or rely on the e-mails.
