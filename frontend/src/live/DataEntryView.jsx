import { useCallback, useEffect, useRef, useState } from "react";
import {
  entryHistory, entryLock, entryRelease, entryStatus, features as fetchFeatures,
  sources as fetchSources, sourceColumns, submitGrid,
} from "../auth/api.js";

const START_ROWS = 10;
const HEARTBEAT_MS = 120000;       // while editing: renew the slot every 2 minutes
const WAIT_POLL_MS = 15000;        // while someone else edits: look again every 15 seconds
const emptyRow = (n) => Array(n).fill("");
const ACTION = { GRID_SENT: "Sent data", GRID_REJECTED: "Rejected (validation)", GRID_TAKEOVER: "Editing slot released by admin", GRID_LOCK: "Started editing" };

// ---- column-level checks by data type (the server repeats them; this is for instant feedback) ----
function validDate(v, fmt) {
  const parts = fmt === "dd-MM-yyyy" ? v.match(/^(\d{2})-(\d{2})-(\d{4})$/) : (!fmt || fmt === "yyyy-MM-dd") ? v.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!parts) return fmt && fmt !== "dd-MM-yyyy" && fmt !== "yyyy-MM-dd";        // other formats: the server decides
  const [d, mo, y] = fmt === "dd-MM-yyyy" ? [+parts[1], +parts[2], +parts[3]] : [+parts[3], +parts[2], +parts[1]];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}
function cellError(col, value) {
  const v = value.trim();
  if (!v) return col.required ? "Required" : "";
  const t = (col.type || "string").toLowerCase();
  if (t === "date" || t === "timestamp") return validDate(v, col.date_format) ? "" : `Use ${col.date_format || "yyyy-MM-dd"}`;
  if (t === "int" || t === "bigint") return /^-?\d+$/.test(v) ? "" : "Whole number expected";
  if (t === "double") return Number.isFinite(Number(v)) ? "" : "Number expected";
  const m = t.match(/^decimal\((\d+),\s*(\d+)\)$/);
  if (m) {
    const d = v.match(/^-?(\d+)(?:\.(\d+))?$/);
    if (!d) return "Number expected, e.g. 1250.50";
    if (d[1].replace(/^0+/, "").length > +m[1] - +m[2]) return "Number is too large";
    if (d[2] && d[2].length > +m[2]) return `Max ${m[2]} decimal places`;
    return "";
  }
  if (t === "boolean") return /^(true|false|yes|no|y|n|1|0)$/i.test(v) ? "" : "Use yes/no or true/false";
  return "";
}

export default function DataEntryView({ goUploads, isAdmin }) {
  const [allowed, setAllowed] = useState(null);
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState("");
  const [cols, setCols] = useState([]);
  const [rows, setRows] = useState([]);
  const [lock, setLock] = useState({ mine: false, free: true, holder: null });
  const [checked, setChecked] = useState(false);       // red cells only after the first "Send"
  const [serverErrors, setServerErrors] = useState({}); // "gridRow:Column" -> message
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);                 // { ok, text }
  const [history, setHistory] = useState([]);
  const mineRef = useRef(false);
  mineRef.current = lock.mine;

  const loadHistory = useCallback(() => entryHistory().then(setHistory).catch(() => {}), []);
  useEffect(() => {
    fetchFeatures().then((f) => setAllowed(f.data_entry)).catch(() => setAllowed(false));
    fetchSources().then((s) => { setSources(s); setSource((cur) => cur || s[0] || ""); }).catch((e) => setMsg({ ok: false, text: e.message }));
    loadHistory();
  }, [loadHistory]);

  const resetTable = useCallback((c) => {
    setRows(Array.from({ length: START_ROWS }, () => emptyRow(c.length)));
    setChecked(false); setServerErrors({});
  }, []);

  // columns of the chosen data type
  useEffect(() => {
    if (!allowed || !source) return undefined;
    let alive = true;
    sourceColumns(source).then((c) => { if (alive) { setCols(c); resetTable(c); setMsg(null); } })
      .catch((e) => alive && setMsg({ ok: false, text: e.message }));
    return () => { alive = false; };
  }, [allowed, source, resetTable]);

  // the editing slot: while someone else holds it we only watch; while we hold it we keep renewing it
  useEffect(() => {
    if (!allowed || !source) return undefined;
    let alive = true;
    let timer;
    setLock({ mine: false, free: true, holder: null });
    const tick = async () => {
      try {
        const st = mineRef.current ? await entryLock(source) : await entryStatus(source);   // renew only when it is ours
        if (alive) setLock(st);
      } catch { /* try again at the next tick */ }
      if (alive) timer = setTimeout(tick, mineRef.current ? HEARTBEAT_MS : WAIT_POLL_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      alive = false; clearTimeout(timer);
      if (mineRef.current) entryRelease(source).catch(() => {});                              // leaving the page frees the slot
    };
  }, [allowed, source]);

  async function startEditing() {
    setMsg(null);
    try {
      const st = await entryLock(source);
      setLock(st);
      if (!st.mine) setMsg({ ok: false, text: `${st.holder?.name || "Someone"} is editing this data type right now.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  async function stopEditing() {
    await entryRelease(source).catch(() => {});
    setLock({ mine: false, free: true, holder: null });
    resetTable(cols);
  }
  async function takeOver() {
    if (!window.confirm(`Release the editing slot of ${lock.holder?.name}? Their unsent entries will not be saved.`)) return;
    try { await entryRelease(source, true); await startEditing(); loadHistory(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }

  if (allowed === null) return <p className="live-muted">Loading…</p>;
  if (!allowed) {
    return (
      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">PRO AND ELITE</span><h2>Enter data in a table</h2>
          <p>Type or paste your data into a spreadsheet-style table and send it with one click, without preparing a file.
            This is included in the Pro and Elite plans. Contact us to upgrade.</p>
        </div></div>
        <button className="subtle-action" onClick={goUploads}>Upload a file instead</button>
      </section>
    );
  }

  const editable = lock.mine && !busy;
  const setCell = (r, c, v) => {
    setRows((rs) => rs.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
    setServerErrors((e) => { if (!Object.keys(e).length) return e; const n = { ...e }; delete n[`${r}:${cols[c].name}`]; return n; });
  };
  const addRows = (n = 5) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => emptyRow(cols.length))]);
  const removeRow = (r) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== r) : rs));

  function onPaste(e, r, c) {                           // paste a block straight from Excel / Google Sheets
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    setRows((rs) => {
      const next = rs.map((row) => [...row]);
      block.forEach((line, i) => {
        while (next.length <= r + i) next.push(emptyRow(cols.length));
        line.forEach((val, j) => { if (c + j < cols.length) next[r + i][c + j] = val; });
      });
      return next;
    });
  }

  const filledIdx = rows.map((row, i) => (row.some((v) => v.trim()) ? i : -1)).filter((i) => i >= 0);
  const localErrors = filledIdx.reduce((n, i) => n + rows[i].filter((v, j) => cellError(cols[j], v)).length, 0);
  const serverCount = Object.keys(serverErrors).length;

  async function send() {
    setChecked(true); setMsg(null); setServerErrors({});
    if (!filledIdx.length) return setMsg({ ok: false, text: "Add at least one row first." });
    if (localErrors) return setMsg({ ok: false, text: `${localErrors} cell${localErrors > 1 ? "s need" : " needs"} fixing (marked in red). Nothing was sent.` });
    setBusy(true);
    try {
      const res = await submitGrid(source, filledIdx.map((i) => rows[i]));
      setMsg({ ok: true, text: `${res.rows} row${res.rows > 1 ? "s" : ""} sent. Processing starts shortly.` });
      setLock({ mine: false, free: true, holder: null });                  // the server released the slot
      resetTable(cols); loadHistory();
    } catch (e) {
      if (e.code === "validation_failed" && e.data?.errors) {
        const map = {};
        e.data.errors.forEach((x) => { map[`${filledIdx[x.row - 1]}:${x.column}`] = x.message; });
        setServerErrors(map);
        setMsg({ ok: false, text: `${e.data.errors.length} problem${e.data.errors.length > 1 ? "s" : ""} found. Nothing was sent - fix the cells marked in red.` });
        loadHistory();
      } else if (e.code === "lock_required" || e.code === "locked_by_other") {
        setMsg({ ok: false, text: "Your editing slot has ended, so nothing was sent. Your entries are still here - press Start editing and send again." });
        setLock({ mine: false, free: e.code === "lock_required", holder: null });
        entryStatus(source).then(setLock).catch(() => {});
      } else {
        setMsg({ ok: false, text: e.code === "plan_required" ? "Table entry is included in the Pro and Elite plans." : e.message });
      }
    }
    setBusy(false);
  }

  const banner = lock.mine
    ? <p className="grid-banner mine">You are editing this data type. Others must wait until you send or stop. The slot is renewed while this page is open.</p>
    : lock.free
      ? <p className="grid-banner">Press <b>Start editing</b> to reserve this data type. Only one person can enter data at a time.</p>
      : <p className="grid-banner other"><b>{lock.holder?.name}</b> is entering data for this data type
          {lock.holder?.since && <> (since {new Date(lock.holder.since).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})</>}.
          Please wait - this page updates by itself when it is free.</p>;

  return (
    <>
      <section className="portal-panel grid-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">PRO AND ELITE</span>
          <h2>Enter data in a table</h2>
          <p>Type or paste rows from Excel. Every column is checked against its data type before anything is sent. Rows with an existing key update that record.</p>
        </div></div>
        {msg && <p className={msg.ok ? "live-ok" : "live-error"}>{msg.text}{msg.ok && <> <button className="link-btn" onClick={goUploads}>View status</button></>}</p>}
        <div className="live-row">
          <label className="live-field">Data type
            <select value={source} onChange={(e) => setSource(e.target.value)} disabled={busy || lock.mine}>
              {sources.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          {!lock.mine && lock.free && <button className="button button-primary" onClick={startEditing}>Start editing</button>}
          {!lock.mine && !lock.free && isAdmin && <button className="subtle-action" onClick={takeOver}>Take over (admin)</button>}
          {lock.mine && <button className="subtle-action" onClick={stopEditing} disabled={busy}>Stop editing</button>}
          <span className="live-muted">{filledIdx.length} row{filledIdx.length === 1 ? "" : "s"} filled</span>
        </div>
        {banner}
        <div className="grid-wrap">
          <table className="grid-table">
            <thead><tr>
              <th className="grid-no">#</th>
              {cols.map((c) => (
                <th key={c.name} title={`${c.name} (${c.type}${c.date_format ? `, ${c.date_format}` : ""})`}>
                  {c.name}{c.required ? " *" : ""}{c.key ? " 🔑" : ""}
                  <small>{c.date_format || c.type}</small>
                </th>
              ))}
              <th className="grid-no" />
            </tr></thead>
            <tbody>
              {rows.map((row, r) => {
                const active = row.some((v) => v.trim());
                return (
                  <tr key={r}>
                    <td className="grid-no">{r + 1}</td>
                    {row.map((v, c) => {
                      const bad = serverErrors[`${r}:${cols[c].name}`] || (checked && active ? cellError(cols[c], v) : "");
                      return (
                        <td key={c}>
                          <input value={v} className={bad ? "grid-bad" : ""} title={bad} aria-label={`${cols[c].name}, row ${r + 1}`}
                            onChange={(e) => setCell(r, c, e.target.value)} onPaste={(e) => onPaste(e, r, c)} disabled={!editable} />
                        </td>
                      );
                    })}
                    <td className="grid-no">{editable && <button className="link-btn" onClick={() => removeRow(r)} aria-label={`Remove row ${r + 1}`}>×</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="live-row">
          <button className="subtle-action" onClick={() => addRows(5)} disabled={!editable}>+ Add 5 rows</button>
          <button className="subtle-action" onClick={() => resetTable(cols)} disabled={!editable}>Clear</button>
          <button className="button button-primary" onClick={send} disabled={!editable || !cols.length}>{busy ? "Checking and sending…" : "Send data"}</button>
          {serverCount > 0 && <span className="live-error">{serverCount} problem{serverCount > 1 ? "s" : ""} to fix</span>}
        </div>
        <p className="live-muted">* required · 🔑 identifies a record (must be unique) · dates use the format under each heading · up to 5,000 rows per send.</p>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">AUDIT TRAIL</span><h2>Who entered what</h2>
        </div><button className="subtle-action" onClick={loadHistory}>Refresh</button></div>
        {history.length === 0 ? <p className="live-muted">No table entries yet.</p> : (
          <div className="live-table-wrap"><table className="live-table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
            <tbody>{history.map((h, i) => (
              <tr key={i}><td>{new Date(h.at).toLocaleString("en-GB")}</td><td>{h.who}</td><td>{ACTION[h.action] || h.action}</td><td>{h.detail}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
