
import { useCallback, useEffect, useState } from "react";
import { entryHistory, runs as fetchRuns, tables as fetchTables, uploadFile } from "../auth/api.js";

const PILL = { SUCCESS: "ok", WARNING: "warn", FAILED: "bad", RUNNING: "run" };
const LABEL = { SUCCESS: "Processed", WARNING: "Processed with warnings", FAILED: "Failed", RUNNING: "Processing" };
const WHAT = { UPLOAD: "Uploaded a file", GRID_SENT: "Sent table data" };
const slugOf = (t) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export default function UploadsView() {
  const [names, setNames] = useState([]);                // tables used before (offered as suggestions)
  const [table, setTable] = useState("");
  const [results, setResults] = useState([]);
  const [runs, setRuns] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(() => fetchRuns().then(setRuns).catch(() => {}), []);
  const loadHistory = useCallback(() => entryHistory().then((h) => setHistory(h.filter((x) => x.action in WHAT))).catch(() => {}), []);
  const loadNames = useCallback(() => fetchTables().then((t) => setNames(t.map((x) => x.title))).catch((e) => setError(e.message)), []);
  useEffect(() => {
    loadNames(); loadRuns(); loadHistory();
    const t = setInterval(loadRuns, 20000);                    // processing status updates by itself
    return () => clearInterval(t);
  }, [loadNames, loadRuns, loadHistory]);

  const ready = slugOf(table).length >= 2;
  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !ready) return;
    setBusy(true); setError("");
    for (const f of files) {
      try { const r = await uploadFile(table.trim(), f); setResults((x) => [{ name: f.name, ok: true, as: r.uploaded }, ...x]); }
      catch (err) { setResults((x) => [{ name: f.name, ok: false, msg: err.message }, ...x]); }
    }
    setBusy(false);
    loadNames(); loadHistory();
    setTimeout(loadRuns, 4000);
  }

  return (
    <>
      <section className="portal-panel upload-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">SEND YOUR DATA</span>
          <h2>Upload files</h2>
          <p>Name the table first. Your file is saved under that name with the date and time, and we record who uploaded it.</p>
        </div></div>
        {error && <p className="live-error">{error}</p>}
        <div className="live-row">
          <label className="live-field">Table name
            <input type="text" list="table-names" value={table} maxLength={60} placeholder="Choose or type a table name" onChange={(e) => setTable(e.target.value)} />
            <datalist id="table-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          {ready && <span className="live-muted">Saved as <b>{slugOf(table)}_{new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_")}</b>.csv / .xlsx … (date and time in UTC)</span>}
        </div>
        <label className="upload-dropzone">
          <input type="file" multiple accept=".csv,.xlsx,.json,.txt" disabled={busy || !ready} onChange={onFiles} />
          <strong>{busy ? "Uploading…" : ready ? "Choose files or drag them here" : "Enter a table name first"}</strong>
          <small>CSV, Excel (.xlsx) or JSON · up to 50 MB per file</small>
          <span className="button button-outline">Browse files</span>
        </label>
        {results.length > 0 && (
          <ul className="live-results">
            {results.slice(0, 6).map((r, i) => (
              <li key={i} className={r.ok ? "ok" : "bad"}>{r.name} — {r.ok ? `uploaded as ${r.as}` : r.msg}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">AUDIT TRAIL</span><h2>Who uploaded what</h2>
        </div><button className="subtle-action" onClick={loadHistory}>Refresh</button></div>
        {history.length === 0 ? <p className="live-muted">Nothing uploaded yet.</p> : (
          <div className="live-table-wrap"><table className="live-table">
            <thead><tr><th>When</th><th>Who</th><th>Table</th><th>What</th><th>File</th></tr></thead>
            <tbody>{history.slice(0, 30).map((h, i) => (
              <tr key={i}><td>{new Date(h.at).toLocaleString("en-GB")}</td><td>{h.who}</td><td>{h.table.replace(/_/g, " ")}</td><td>{WHAT[h.action]}</td><td>{h.detail.split("->").pop().trim()}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">PROCESSING</span><h2>Recent uploads</h2>
        </div><button className="subtle-action" onClick={loadRuns}>Refresh</button></div>
        {runs.length === 0 ? <p className="live-muted">Nothing processed yet.</p> : (
          <div className="live-table-wrap"><table className="live-table">
            <thead><tr><th>Data type</th><th>Status</th><th>When</th><th>Rows</th><th>Note</th></tr></thead>
            <tbody>{runs.map((r, i) => (
              <tr key={i}>
                <td>{r.source.replace(/_/g, " ")}</td>
                <td><span className={`pill ${PILL[r.status] || ""}`}>{LABEL[r.status] || r.status}</span></td>
                <td>{new Date(r.started_at).toLocaleString("en-GB")}</td>
                <td>{r.rows_loaded ?? "—"}{r.rows_rejected ? ` (+${r.rows_rejected} rejected)` : ""}</td>
                <td>{r.message}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
