import { useCallback, useEffect, useState } from "react";
import { runs as fetchRuns, sources as fetchSources, templateUrl, uploadFile } from "../auth/api.js";

const PILL = { SUCCESS: "ok", WARNING: "warn", FAILED: "bad", RUNNING: "run" };
const LABEL = { SUCCESS: "Processed", WARNING: "Processed with warnings", FAILED: "Failed", RUNNING: "Processing" };

export default function UploadsView() {
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState("");
  const [results, setResults] = useState([]);
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(() => fetchRuns().then(setRuns).catch(() => {}), []);
  useEffect(() => {
    fetchSources().then((s) => { setSources(s); setSource((cur) => cur || s[0] || ""); }).catch((e) => setError(e.message));
    loadRuns();
    const t = setInterval(loadRuns, 20000);                    // processing status updates by itself
    return () => clearInterval(t);
  }, [loadRuns]);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !source) return;
    setBusy(true); setError("");
    for (const f of files) {
      try { await uploadFile(source, f); setResults((r) => [{ name: f.name, ok: true }, ...r]); }
      catch (err) { setResults((r) => [{ name: f.name, ok: false, msg: err.message }, ...r]); }
    }
    setBusy(false);
    setTimeout(loadRuns, 4000);
  }

  return (
    <>
      <section className="portal-panel upload-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">SEND YOUR DATA</span>
          <h2>Upload files</h2>
          <p>Upload your data and your dashboard updates automatically once it has been processed.</p>
        </div></div>
        {error && <p className="live-error">{error}</p>}
        <div className="live-row">
          <label className="live-field">Data type
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {sources.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          {source && <a className="subtle-action" href={templateUrl(source)}>Download template (CSV)</a>}
        </div>
        <label className="upload-dropzone">
          <input type="file" multiple accept=".csv,.xlsx,.json,.txt" disabled={busy || !source} onChange={onFiles} />
          <strong>{busy ? "Uploading…" : "Choose files or drag them here"}</strong>
          <small>CSV, Excel (.xlsx) or JSON · up to 50 MB per file · use the column names from the template</small>
          <span className="button button-outline">Browse files</span>
        </label>
        {results.length > 0 && (
          <ul className="live-results">
            {results.slice(0, 6).map((r, i) => (
              <li key={i} className={r.ok ? "ok" : "bad"}>{r.name} — {r.ok ? "uploaded, processing will start shortly" : r.msg}</li>
            ))}
          </ul>
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
