import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  entryHistory, entryLock, entryRelease, entryStatus, features as fetchFeatures, saveTable, sendEntry, tables as fetchTables,
} from "../auth/api.js";

const START_ROWS = 10;
const HEARTBEAT_MS = 120000;       // while editing: renew the slot every 2 minutes
const WAIT_POLL_MS = 15000;        // while someone else edits: look again every 15 seconds
const emptyRow = (n) => Array(n).fill("");
const NEW = "__new__";             // "+ New table" in the list
const ACTION = {
  GRID_SENT: "Sent data", GRID_REJECTED: "Rejected (validation)", GRID_TAKEOVER: "Editing slot released by admin",
  GRID_LOCK: "Started editing", GRID_STOP: "Stopped editing", TABLE_SAVED: "Saved the table", UPLOAD: "Uploaded a file",
};
const TYPE_OPTIONS = [
  ["text", "Text"], ["whole", "Whole number"], ["decimal", "Decimal number"],
  ["date:dd-MM-yyyy", "Date (dd-MM-yyyy)"], ["date:yyyy-MM-dd", "Date (yyyy-MM-dd)"],
  ["date:dd/MM/yyyy", "Date (dd/MM/yyyy)"], ["date:MM/dd/yyyy", "Date (MM/dd/yyyy)"], ["yesno", "Yes / No"],
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS);
const newDef = () => ({ name: "", type: "text" });
const fromSaved = (d) => ({ name: d.name, type: d.type === "date" ? `date:${d.date_format}` : d.type });   // saved column -> heading
function defToCol(d) {                            // what the cell checks need to know about a column
  const [kind, fmt] = d.type.split(":");
  const type = { text: "string", whole: "bigint", decimal: "decimal(18,4)", date: "date", yesno: "boolean" }[kind];
  return { name: d.name.trim(), type, date_format: fmt || null, key: false, required: false };
}
const defToPayload = (d) => { const [kind, fmt] = d.type.split(":"); return { name: d.name.trim(), type: kind, decimals: 4, date_format: fmt || null }; };
const slugOf = (t) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// ---- column-level checks by data type (the server repeats them; this is for instant feedback) ----
function validDate(v, fmt) {
  const f = fmt || "yyyy-MM-dd";
  if (/[A-Za-z]/.test(f.replace(/yyyy|MM|dd|HH|mm|ss/g, ""))) return true;        // unusual format: the server decides
  const order = [];
  const re = new RegExp("^" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/yyyy|MM|dd|HH|mm|ss/g, (t) => { order.push(t); return t === "yyyy" ? "(\\d{4})" : "(\\d{2})"; }) + "$");
  const m = v.match(re);
  if (!m) return false;
  const p = {};
  order.forEach((t, i) => { p[t] = +m[i + 1]; });
  if (p.yyyy !== undefined && p.MM !== undefined && p.dd !== undefined) {
    const dt = new Date(p.yyyy, p.MM - 1, p.dd);
    if (dt.getFullYear() !== p.yyyy || dt.getMonth() !== p.MM - 1 || dt.getDate() !== p.dd) return false;
  }
  if ((p.HH !== undefined && p.HH > 23) || (p.mm !== undefined && p.mm > 59) || (p.ss !== undefined && p.ss > 59)) return false;
  return true;
}
function cellError(col, value) {
  const v = value.trim();
  if (!v) return col.required ? "Required" : "";
  const t = (col.type || "string").toLowerCase();
  if (t === "timestamp" && !col.date_format) return "";                              // server checks it
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
  const [saved, setSaved] = useState([]);                // the client's tables that have columns
  const [table, setTable] = useState("");                // name of the chosen table, or NEW
  const [title, setTitle] = useState("");                // name typed for a new table
  const [defs, setDefs] = useState([newDef(), newDef(), newDef()]);   // the column headings: name + data type
  const [rows, setRows] = useState([]);
  const [lock, setLock] = useState({ mine: false, free: true, holder: null });
  const [checked, setChecked] = useState(false);        // red cells for everything after the first "Send"
  const [touched, setTouched] = useState({});           // cells already left -> checked straight away
  const [serverErrors, setServerErrors] = useState({}); // "gridRow:Column" -> message
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);                 // { ok, text }
  const [history, setHistory] = useState([]);
  const tableRef = useRef(null);
  const justFocused = useRef(false);                    // first click on a cell selects its whole value
  const keepSheet = useRef(false);                      // after "Save table" the typed rows stay
  const isNew = table === NEW;
  const cols = useMemo(() => defs.map(defToCol), [defs]);
  const mineRef = useRef(false);
  mineRef.current = lock.mine;
  const open = isNew || lock.mine;                      // headings and cells can be changed
  const canEdit = open && !busy;

  const loadHistory = useCallback(() => entryHistory().then(setHistory).catch(() => {}), []);
  const loadTables = useCallback(() => fetchTables().then((t) => { const list = t.filter((x) => x.defs); setSaved(list); return list; }), []);

  const resetSheet = useCallback((n) => {
    setRows(Array.from({ length: START_ROWS }, () => emptyRow(n)));
    setChecked(false); setServerErrors({}); setTouched({});
  }, []);

  useEffect(() => {
    fetchFeatures().then((f) => setAllowed(f.data_entry)).catch(() => setAllowed(false));
    loadTables().then((list) => setTable((cur) => cur || (list[0] ? list[0].name : NEW))).catch((e) => setMsg({ ok: false, text: e.message }));
    loadHistory();
  }, [loadTables, loadHistory]);

  // choosing a table: a saved one brings its columns, a new one starts with empty headings
  useEffect(() => {
    if (!allowed || !table) return;
    if (keepSheet.current) { keepSheet.current = false; return; }
    const d = isNew ? [newDef(), newDef(), newDef()] : (saved.find((x) => x.name === table)?.defs || []).map(fromSaved);
    setDefs(d.length ? d : [newDef()]);
    if (isNew) setTitle("");
    resetSheet(d.length || 1);
    setMsg(null);
  }, [allowed, table]); // eslint-disable-line react-hooks/exhaustive-deps

  // the editing slot of a saved table: while someone else holds it we only watch; while we hold it we keep renewing it
  useEffect(() => {
    setLock({ mine: false, free: true, holder: null });
    if (!allowed || !table || isNew) return undefined;
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const st = mineRef.current ? await entryLock(table) : await entryStatus(table);
        if (alive) setLock(st);
      } catch { /* try again at the next tick */ }
      if (alive) timer = setTimeout(tick, mineRef.current ? HEARTBEAT_MS : WAIT_POLL_MS);
    };
    timer = setTimeout(tick, 0);
    return () => {
      alive = false; clearTimeout(timer);
      if (mineRef.current) entryRelease(table).catch(() => {});                           // leaving the page frees the slot
    };
  }, [allowed, table, isNew]);

  async function startEditing() {
    setMsg(null);
    try {
      const st = await entryLock(table);
      setLock(st);
      if (!st.mine) setMsg({ ok: false, text: `${st.holder?.name || "Someone"} is editing this table right now.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  async function stopEditing() {
    await entryRelease(table).catch(() => {});
    setLock({ mine: false, free: true, holder: null });
    const d = (saved.find((x) => x.name === table)?.defs || []).map(fromSaved);   // back to the saved columns
    setDefs(d); resetSheet(d.length);
  }
  async function takeOver() {
    if (!window.confirm(`Release the editing slot of ${lock.holder?.name}? Their unsent entries will not be saved.`)) return;
    try { await entryRelease(table, true); await startEditing(); loadHistory(); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }

  if (allowed === null) return <p className="live-muted">Loading…</p>;
  if (!allowed) {
    return (
      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <h2>Enter data in a table</h2>
          <p>Type or paste your data into a spreadsheet-style table and send it with one click, without preparing a file.
            This is included in the Pro and Elite plans. Contact us to upgrade.</p>
        </div></div>
        <button className="subtle-action" onClick={goUploads}>Upload a file instead</button>
      </section>
    );
  }

  const setDef = (j, patch) => setDefs((d) => d.map((x, i) => (i === j ? { ...x, ...patch } : x)));
  const addCol = () => { setDefs((d) => [...d, newDef()]); setRows((rs) => rs.map((r) => [...r, ""])); };
  const removeCol = (j) => {
    if (defs.length < 2) return;
    setDefs((d) => d.filter((_, i) => i !== j)); setRows((rs) => rs.map((r) => r.filter((_, i) => i !== j)));
    setServerErrors({}); setTouched({});
  };
  const setCell = (r, c, v) => {
    setRows((rs) => rs.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
    setServerErrors((e) => { if (!Object.keys(e).length) return e; const n = { ...e }; delete n[`${r}:${cols[c].name}`]; return n; });
  };
  const addRows = (n = 5) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => emptyRow(cols.length))]);
  const removeRow = (r) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== r) : rs));

  // ---- spreadsheet-style movement: arrows, Enter, whole-cell copy / cut ----
  const focusCell = (r, c) => {
    const el = tableRef.current?.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    if (el) { el.focus(); return true; }
    return false;
  };
  function onKey(e, r, c) {
    const el = e.target;
    const len = el.value.length;
    const whole = el.selectionStart === 0 && el.selectionEnd === len;            // whole value selected (after arrow / click into the cell)
    const atEnd = el.selectionStart === len && el.selectionEnd === len;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const go = (nr, nc) => {
      e.preventDefault();
      if (nr >= rows.length) { addRows(5); setTimeout(() => focusCell(nr, nc), 30); } else focusCell(nr, nc);
    };
    if (e.key === "Enter") return go(e.shiftKey ? Math.max(r - 1, 0) : r + 1, c);
    if (e.key === "ArrowDown") return go(r + 1, c);
    if (e.key === "ArrowUp" && r > 0) return go(r - 1, c);
    if (e.key === "ArrowRight" && (atEnd || whole) && c < cols.length - 1) return go(r, c + 1);
    if (e.key === "ArrowLeft" && (atStart || whole) && c > 0) return go(r, c - 1);
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "x") && el.selectionStart === el.selectionEnd && len) {
      e.preventDefault();                                                           // nothing selected: copy the whole cell
      navigator.clipboard?.writeText(el.value).catch(() => {});
      if (e.key === "x") setCell(r, c, "");
    }
  }

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

  const clearSheet = () => {
    if (filledIdx.length && !window.confirm(`Remove the ${filledIdx.length} row${filledIdx.length > 1 ? "s" : ""} you typed? This cannot be undone.`)) return;
    resetSheet(cols.length);
  };
  const aligned = rows.every((r) => r.length === cols.length);   // for one render after switching tables the old rows do not fit yet
  const filledIdx = rows.map((row, i) => (row.some((v) => v.trim()) ? i : -1)).filter((i) => i >= 0);
  const localErrors = filledIdx.reduce((n, i) => n + rows[i].filter((v, j) => cols[j] && cellError(cols[j], v)).length, 0);
  const serverCount = Object.keys(serverErrors).length;
  const name = isNew ? slugOf(title) : table;
  const fileName = `${name || "table_name"}_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_")}.csv`;

  function headingsProblem() {                          // the table needs a name, and every column a unique name
    if (isNew) {
      if (!title.trim()) return "Give your table a name first.";
      if (name.length < 2) return "The table name needs at least 2 letters or numbers.";
      if (saved.some((x) => x.name === name)) return "You already have a table with this name. Choose it from the list.";
    }
    const names = defs.map((d) => d.name.trim().toLowerCase());
    if (names.some((n) => !n)) return "Every column needs a name (type it in the column heading).";
    if (new Set(names).size !== names.length) return "Two columns have the same name.";
    return "";
  }

  async function save() {
    const problem = headingsProblem();
    if (problem) return setMsg({ ok: false, text: problem });
    setBusy(true); setMsg(null);
    try {
      await saveTable(isNew ? title.trim() : table, defs.map(defToPayload));
      await loadTables(); loadHistory();
      if (isNew) { keepSheet.current = true; setTable(name); }
      setMsg({ ok: true, text: isNew ? "Table saved. It is in the list now - press Start editing to enter data." : "Columns saved." });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  }

  async function send() {
    setChecked(true); setMsg(null); setServerErrors({});
    const problem = headingsProblem();
    if (problem) return setMsg({ ok: false, text: problem });
    if (!filledIdx.length) return setMsg({ ok: false, text: "Add at least one row first." });
    if (localErrors) return setMsg({ ok: false, text: `${localErrors} cell${localErrors > 1 ? "s need" : " needs"} fixing (marked in red). Nothing was sent.` });
    setBusy(true);
    try {
      const res = await sendEntry(isNew ? title.trim() : table, defs.map(defToPayload), filledIdx.map((i) => rows[i]));
      setMsg({ ok: true, text: `${res.rows} row${res.rows > 1 ? "s" : ""} sent as ${res.uploaded}.` });
      await loadTables();
      if (isNew) setTable(res.table); else setLock({ mine: false, free: true, holder: null });   // the server released the slot
      loadHistory();
      const d = defs; resetSheet(d.length);
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
        entryStatus(table).then(setLock).catch(() => {});
      } else {
        setMsg({ ok: false, text: e.code === "plan_required" ? "Table entry is included in the Pro and Elite plans." : e.message });
      }
    }
    setBusy(false);
  }

  const banner = isNew
    ? "A new table: name it, then name each column and choose its data type in the column headings. Save it once and it stays in your list."
    : lock.mine
      ? "You are editing this table. Others must wait until you send or stop."
      : lock.free
        ? "Press Start editing to add data. Only one person can edit a table at a time."
        : null;

  return (
    <>
      <section className="portal-panel grid-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">PRO AND ELITE</span>
          <h2>Enter data in a table</h2>
          <p>Type or paste rows from Excel. Every column is checked against its data type before anything is sent.</p>
        </div></div>
        {msg && <p className={msg.ok ? "live-ok" : "live-error"}>{msg.text}{msg.ok && msg.text.includes("sent as") && <> <button className="link-btn" onClick={goUploads}>View uploads</button></>}</p>}
        <div className="live-row">
          <label className="live-field">Table
            <select value={table} onChange={(e) => setTable(e.target.value)} disabled={busy || lock.mine}>
              {saved.map((t) => <option key={t.name} value={t.name}>{t.title}</option>)}
              <option value={NEW}>+ New table…</option>
            </select>
          </label>
          {isNew && (
            <label className="live-field">Table name
              <input type="text" value={title} maxLength={60} placeholder="e.g. Campaigns" onChange={(e) => setTitle(e.target.value)} disabled={busy} />
            </label>
          )}
          {!isNew && !lock.mine && lock.free && <button className="grid-btn" onClick={startEditing}>Start editing</button>}
          {!isNew && !lock.mine && !lock.free && isAdmin && <button className="grid-btn" onClick={takeOver}>Take over (admin)</button>}
          {!isNew && lock.mine && <button className="grid-btn" onClick={stopEditing} disabled={busy}>Stop editing</button>}
          <span className="live-muted">{filledIdx.length} row{filledIdx.length === 1 ? "" : "s"} filled</span>
        </div>
        {banner && <p className={lock.mine ? "grid-banner mine" : "grid-banner"}>{banner}</p>}
        {!isNew && !lock.mine && !lock.free && (
          <p className="grid-banner other"><b>{lock.holder?.name}</b> is entering data for this table
            {lock.holder?.since && <> (since {new Date(lock.holder.since).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})</>}.
            Please wait - this page updates by itself when it is free.</p>
        )}
        <p className="live-muted">Each send is saved as <b>{fileName}</b> (date and time in UTC).</p>
        <div className="grid-wrap">
          <table className="grid-table" ref={tableRef}>
            <thead><tr>
              <th className="grid-no">#</th>
              {defs.map((d, ci) => (
                open ? (
                  <th key={ci} className="grid-custom-head">
                    <input value={d.name} placeholder="Column name" maxLength={60} aria-label={`Column ${ci + 1} name`} onChange={(e) => setDef(ci, { name: e.target.value })} />
                    <select value={d.type} aria-label={`Column ${ci + 1} data type`} onChange={(e) => setDef(ci, { type: e.target.value })}>
                      {TYPE_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {defs.length > 1 && <button className="link-btn" onClick={() => removeCol(ci)} aria-label={`Remove column ${ci + 1}`}>×</button>}
                  </th>
                ) : (
                  <th key={ci}>{d.name || "—"}<small>{TYPE_LABEL[d.type] || d.type}</small></th>
                )
              ))}
              <th className="grid-no" />
            </tr></thead>
            <tbody>
              {aligned && rows.map((row, r) => {
                const active = row.some((v) => v.trim());
                return (
                  <tr key={r}>
                    <td className="grid-no">{r + 1}</td>
                    {row.map((v, c) => {
                      const bad = serverErrors[`${r}:${cols[c].name}`] || ((checked || touched[`${r}:${c}`]) && active ? cellError(cols[c], v) : "");
                      return (
                        <td key={c}>
                          <input value={v} className={bad ? "grid-bad" : ""} title={bad} aria-label={`${cols[c].name || `Column ${c + 1}`}, row ${r + 1}`}
                            data-r={r} data-c={c}
                            onChange={(e) => setCell(r, c, e.target.value)} onPaste={(e) => onPaste(e, r, c)} onKeyDown={(e) => onKey(e, r, c)}
                            onFocus={(e) => { justFocused.current = true; e.target.select(); }}
                            onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } }}
                            onBlur={() => setTouched((t) => (t[`${r}:${c}`] ? t : { ...t, [`${r}:${c}`]: 1 }))} disabled={!canEdit} />
                        </td>
                      );
                    })}
                    <td className="grid-no">{canEdit && <button className="link-btn" onClick={() => removeRow(r)} aria-label={`Remove row ${r + 1}`}>×</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="live-row">
          <button className="grid-btn" onClick={() => addRows(5)} disabled={!canEdit}>+ Add 5 rows</button>
          <button className="grid-btn" onClick={addCol} disabled={!canEdit || defs.length >= 60}>+ Add column</button>
          <button className="grid-btn" onClick={save} disabled={!canEdit}>{isNew ? "Save table" : "Save columns"}</button>
          <button className="grid-btn primary" onClick={send} disabled={!canEdit}>{busy ? "Sending…" : "Send data"}</button>
          {serverCount > 0 && <span className="live-error">{serverCount} problem{serverCount > 1 ? "s" : ""} to fix</span>}
          <button className="grid-btn danger push-right" onClick={clearSheet} disabled={!canEdit}>Clear all rows</button>
        </div>
        <p className="live-muted">Dates use the format chosen for the column · up to 5,000 rows per send.</p>
      </section>

      <section className="portal-panel">
        <div className="portal-panel-head"><div>
          <span className="portal-panel-kicker">AUDIT TRAIL</span><h2>Who did what</h2>
        </div><button className="subtle-action" onClick={loadHistory}>Refresh</button></div>
        {history.length === 0 ? <p className="live-muted">Nothing yet.</p> : (
          <div className="live-table-wrap"><table className="live-table">
            <thead><tr><th>When</th><th>Who</th><th>Table</th><th>What</th><th>Details</th></tr></thead>
            <tbody>{history.slice(0, 30).map((h, i) => (
              <tr key={i}><td>{new Date(h.at).toLocaleString("en-GB")}</td><td>{h.who}</td><td>{h.table.replace(/_/g, " ")}</td><td>{ACTION[h.action] || h.action}</td><td>{h.detail}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
