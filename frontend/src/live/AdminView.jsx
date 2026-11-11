import { useCallback, useEffect, useState } from "react";
import { activityLog, adminLock, adminUnlock, getVisibility, inviteUser, listUsers, resetPassword, setVisibility, updateUser } from "../auth/api.js";

const ROLES = [["admin", "Administrator"], ["uploader", "Uploader"], ["viewer", "Viewer"]];

function Gate({ onUnlocked }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault(); setErr("");
    try { await adminUnlock(pw); setPw(""); onUnlocked(); } catch (x) { setErr(x.message); }
  }
  return (
    <section className="portal-panel">
      <div className="portal-panel-head"><div>
        <span className="portal-panel-kicker">ADMINISTRATION</span><h2>Confirm your password</h2>
        <p>This area controls who can see and change your workspace. Enter your password to continue.</p>
      </div></div>
      <form className="live-form" onSubmit={submit}>
        <label>Your password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="live-error" role="alert">{err}</p>}
        <button className="button button-primary">Unlock admin area</button>
      </form>
    </section>
  );
}

// Admin decides which dashboards (data sources) an employee may see. Admins themselves are never restricted.
function VisibilityPanel({ user, onSaved, onError }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { getVisibility(user.id).then(setRows).catch((e) => onError(e)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);
  if (!rows) return <p className="live-muted">Loading…</p>;
  const save = async () => {
    try { await setVisibility(user.id, rows.filter((r) => !r.visible).map((r) => r.source)); onSaved(); } catch (e) { onError(e); }
  };
  return (
    <div className="vis-panel">
      <b>Dashboards {user.display_name} can see</b>
      <div className="vis-list">
        {rows.map((r, i) => (
          <label key={r.source}><input type="checkbox" checked={r.visible}
            onChange={() => setRows(rows.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))} />
            {r.source.replace(/_/g, " ")}</label>
        ))}
      </div>
      <button className="button button-primary" onClick={save}>Save visibility</button>
    </div>
  );
}

export default function AdminView({ me }) {
  const [visFor, setVisFor] = useState(null);
  const [locked, setLocked] = useState(false);
  const [users, setUsers] = useState([]);
  const [log, setLog] = useState([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "viewer" });

  const load = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([listUsers(), activityLog()]);
      setUsers(u); setLog(a); setLocked(false);
    } catch (err) {
      if (err.code === "elevation_required") setLocked(true); else setNotice(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okText) => {
    setNotice("");
    let ok = false;
    try { const r = await fn(); setNotice(typeof okText === "function" ? okText(r) : okText); ok = true; }
    catch (err) { if (err.code === "elevation_required") setLocked(true); else setNotice(err.message || "Something went wrong. Please try again."); }
    await load().catch(() => {});                       // always refresh, so the list matches the server
    window.scrollTo({ top: 0, behavior: "smooth" });    // the message sits at the top of the page
    return ok;
  };

  if (locked) return <Gate onUnlocked={load} />;

  return (
    <>
      {notice && <div className="portal-notice" role="status">{notice}</div>}
      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">PEOPLE &amp; ACCESS</span><h2>Employees</h2>
          <p><b>Administrator</b>: everything. <b>Uploader</b>: sees dashboards and uploads data. <b>Viewer</b>: sees dashboards only.</p>
        </div><button className="subtle-action" onClick={async () => { await adminLock().catch(() => {}); setLocked(true); }}>Lock admin area</button></div>
        <div className="live-table-wrap"><table className="live-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>{users.map((u) => {
            const self = u.email === me.email;
            return (
              <tr key={u.id} className={u.is_enabled ? "" : "off"}>
                <td>{u.display_name}</td><td>{u.email}</td>
                <td><select value={u.role} disabled={self} onChange={(e) => act(() => updateUser(u.id, { role: e.target.value }), "Role updated.")}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td><span className={`pill ${u.is_enabled ? (u.pending_first_login ? "warn" : "ok") : "bad"}`}>
                  {!u.is_enabled ? "Disabled" : u.pending_first_login ? "Invited" : "Active"}</span></td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString("en-GB") : "—"}</td>
                <td className="live-actions">
                  {!self && <button className="subtle-action" onClick={() => act(() => updateUser(u.id, { is_enabled: !u.is_enabled }), u.is_enabled ? "Access disabled." : "Access enabled.")}>
                    {u.is_enabled ? "Disable" : "Enable"}</button>}
                  {u.role !== "admin" && <button className="subtle-action" onClick={() => setVisFor(visFor === u.id ? null : u.id)}>Dashboards</button>}
                  <button className="subtle-action" onClick={() => act(() => resetPassword(u.id), (r) => r.emailed ? "A new one-time password was emailed." : "Reset done, but the email could not be sent. Try again.")}>
                    Reset password</button>
                </td>
              </tr>);
          })}</tbody>
        </table></div>

        {visFor && users.find((u) => u.id === visFor) && (
          <VisibilityPanel user={users.find((u) => u.id === visFor)}
            onSaved={() => { setNotice("Visibility saved. It applies within a few seconds."); setVisFor(null); }}
            onError={(e) => setNotice(e.message)} />
        )}

        <h3 className="live-h3">Invite an employee</h3>
        <form className="live-form live-inline" onSubmit={(e) => {
          e.preventDefault();
          act(() => inviteUser(form.email, form.name, form.role), (r) => r.emailed ? "Invitation sent with a one-time password." : "User created, but the email could not be sent. Use “Reset password” to try again.")
            .then((ok) => { if (ok) setForm({ email: "", name: "", role: "viewer" }); });   // keep what was typed if it failed
        }}>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Work email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button className="button button-primary">Send invitation</button>
        </form>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-head"><div><span className="portal-panel-kicker">AUDIT</span><h2>Recent activity</h2></div></div>
        <ul className="live-log">{log.map((l, i) => (
          <li key={i}><span>{new Date(l.at).toLocaleString("en-GB")}</span><b>{l.action.replace(/_/g, " ").toLowerCase()}</b><em>{l.actor}</em>{l.detail && <i>{l.detail}</i>}</li>))}
        </ul>
      </section>
    </>
  );
}
