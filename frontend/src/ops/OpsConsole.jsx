import { useCallback, useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import "../live/live.css";

// Internal page for SkyStack staff only. Sign-in is Microsoft Entra ID; the API only accepts people
// who hold the "Platform.Admin" app role (assigned in Azure). Clients never see this page.
const env = import.meta.env;
const OPS_API = env.VITE_OPS_API_URL || "";
const msal = new PublicClientApplication({
  auth: {
    clientId: env.VITE_ENTRA_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${env.VITE_ENTRA_TENANT_ID || "common"}`,
    redirectUri: `${window.location.origin}/ops`,
  },
  cache: { cacheLocation: "sessionStorage" },
});
const scopes = [env.VITE_ENTRA_API_SCOPE || ""];

async function accessToken(interactive) {
  await msal.initialize();
  let account = msal.getAllAccounts()[0];
  if (!account) {
    if (!interactive) return null;
    account = (await msal.loginPopup({ scopes })).account;
  }
  try { return (await msal.acquireTokenSilent({ scopes, account })).accessToken; }
  catch { return (await msal.acquireTokenPopup({ scopes })).accessToken; }
}

async function ops(path, options = {}) {
  const token = await accessToken(true);
  const res = await fetch(`${OPS_API}/ops${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
}

export default function OpsConsole() {
  const [signedIn, setSignedIn] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [clients, setClients] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ company_name: "", industry: "logistics", admin_name: "", admin_email: "" });

  const load = useCallback(async () => {
    try {
      const [i, c] = await Promise.all([ops("/industries"), ops("/clients")]);
      setIndustries(i); setClients(c); setSignedIn(true);
    } catch (err) { setNotice(err.message); }
  }, []);

  async function subscribe(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const r = await ops("/clients", { method: "POST", body: JSON.stringify(form) });
      setNotice(r.emailed
        ? `Client "${r.client_code}" is live. A one-time password was emailed to ${r.admin_email}.`
        : `Client "${r.client_code}" was created, but the email failed. Use “Resend password”.`);
      setForm({ company_name: "", industry: form.industry, admin_name: "", admin_email: "" });
      await load();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  const toggle = async (c) => { try { await ops(`/clients/${c.client_code}/active`, { method: "POST", body: JSON.stringify({ is_active: !c.is_active }) }); await load(); } catch (e) { setNotice(e.message); } };
  const resend = async (c) => { try { const r = await ops(`/clients/${c.client_code}/resend-otp`, { method: "POST" }); setNotice(r.emailed ? "New one-time password emailed." : "Could not send the email."); } catch (e) { setNotice(e.message); } };

  useEffect(() => { accessToken(false).then((t) => t && load()); }, [load]);

  if (!signedIn) {
    return (
      <div className="live-center"><div className="live-center-card">
        <h1>SkyStack operations</h1>
        <p>Staff sign-in with your Microsoft work account.</p>
        {notice && <p className="live-error">{notice}</p>}
        <button className="button button-primary" onClick={load}>Sign in with Microsoft</button>
      </div></div>
    );
  }

  return (
    <div className="portal-content" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Operations console</h1>
      {notice && <div className="portal-notice" role="status">{notice}</div>}
      <section className="portal-panel">
        <div className="portal-panel-head"><div><span className="portal-panel-kicker">NEW SUBSCRIPTION</span><h2>Subscribe a client</h2>
          <p>Creates their workspace, database, data pipelines and dashboard, then emails the admin a one-time password.</p></div></div>
        <form className="live-form live-inline" onSubmit={subscribe}>
          <label>Company<input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required /></label>
          <label>Industry<select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
            {industries.map((i) => <option key={i} value={i}>{i.replace("_", " ")}</option>)}</select></label>
          <label>Admin name<input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required /></label>
          <label>Admin email<input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required /></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Subscribe"}</button>
        </form>
      </section>
      <section className="portal-panel">
        <div className="portal-panel-head"><div><span className="portal-panel-kicker">CLIENTS</span><h2>All clients</h2></div></div>
        <div className="live-table-wrap"><table className="live-table">
          <thead><tr><th>Client</th><th>Industry</th><th>Users</th><th>Last processed</th><th>Status</th><th /></tr></thead>
          <tbody>{clients.map((c) => (
            <tr key={c.client_code} className={c.is_active ? "" : "off"}>
              <td><b>{c.name}</b><br /><small>{c.client_code}</small></td><td>{c.industry.replace("_", " ")}</td><td>{c.users}</td>
              <td>{c.last_processed_at ? new Date(c.last_processed_at).toLocaleString("en-GB") : "—"}</td>
              <td><span className={`pill ${c.is_active ? "ok" : "bad"}`}>{c.is_active ? "Active" : "Disabled"}</span></td>
              <td className="live-actions">
                <button className="subtle-action" onClick={() => toggle(c)}>{c.is_active ? "Disable" : "Enable"}</button>
                <button className="subtle-action" onClick={() => resend(c)}>Resend password</button>
              </td></tr>))}
          </tbody></table></div>
      </section>
    </div>
  );
}
