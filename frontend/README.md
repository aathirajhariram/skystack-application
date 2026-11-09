# SkyStack corporate website

Premium React + Vite prototype for the SkyStack corporate site and client portal.

## Run locally

```bash
npm install
npm run dev
```

## Demo routes

- `/` — corporate homepage
- `/portal/demo` — client workspace prototype with an illustrative analytics dashboard
- `/login` — login interface prototype
- `/create-profile` — client profile request flow

## Analytics dashboard notes

The demo portal includes an inbuilt illustrative business intelligence dashboard with sample revenue, gross margin, operational performance, revenue by business line, and data-quality indicators. The values are fictional and are clearly labelled as demo data. It is **not connected to Power BI, Microsoft Fabric, a live company database, or ERP systems**.

A production Power BI/Fabric integration requires an authenticated backend, Microsoft Entra ID, report/workspace identifiers, server-generated embed tokens, and strict client/tenant-level permissions. Never put Power BI secrets or embed-token generation logic in browser code. Do not treat the current portal prototype as secure for real client data.

The file-upload area currently records selections locally only; it does not upload files to a server. Employee/profile changes are session-only.

## Live portal (added)
`/login` signs in against the SkyStack API; `/portal/<client>` is the real workspace; `/portal/demo` stays the public demo. The Subscribe popup (header button) talks to the API's `/public` endpoints. See `../docs/SETUP.md`.
