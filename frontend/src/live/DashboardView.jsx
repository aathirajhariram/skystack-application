import { useCallback, useEffect, useState } from "react";
import { dashboard } from "../auth/api.js";

const fmt = (v, kind) => {
  if (v == null) return "—";
  if (kind === "percent") return `${v.toFixed(1)}%`;
  if (kind === "decimal") return v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
};

function Kpi({ tile }) {
  return (
    <div className="live-card kpi">
      <span>{tile.title}</span>
      <strong>{tile.status === "ok" ? fmt(tile.value, tile.format) : "—"}</strong>
      {tile.status !== "ok" && <small>{tile.status === "error" ? "Unavailable right now" : "No data yet"}</small>}
    </div>
  );
}

function Bars({ tile }) {
  const max = Math.max(...tile.data.map((d) => d.value), 1);
  return (
    <div className="bar-list">
      {tile.data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-label" title={d.label}>{d.label}</span>
          <span className="bar-track"><i style={{ width: `${Math.max((d.value / max) * 100, 2)}%` }} /></span>
          <span className="bar-value">{fmt(d.value, tile.format)}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ tile }) {
  const W = 560, H = 170, P = 28;
  const pts = tile.data;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const x = (i) => P + (pts.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (pts.length - 1));
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tile.title}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="axis" />
      <path d={path} className="series" />
      {pts.map((p, i) => <circle key={p.label} cx={x(i)} cy={y(p.value)} r="3" className="dot" />)}
      <text x={P} y={H - 8} className="tick">{pts[0].label}</text>
      <text x={W - P} y={H - 8} className="tick" textAnchor="end">{pts[pts.length - 1].label}</text>
      <text x={P} y={14} className="tick">{fmt(max, tile.format)}</text>
    </svg>
  );
}

function Tile({ tile }) {
  if (tile.type === "KPI") return <Kpi tile={tile} />;
  return (
    <div className={`live-card chart ${tile.type === "LINE" ? "wide" : ""}`}>
      <h3>{tile.title}</h3>
      {tile.status === "ok" ? (tile.type === "BAR" ? <Bars tile={tile} /> : <Line tile={tile} />)
        : <p className="live-muted">{tile.status === "error" ? "Unavailable right now." : "No data yet."}</p>}
    </div>
  );
}

export default function DashboardView({ canUpload, goUploads }) {
  const [state, setState] = useState({ loading: true, error: "", sources: [] });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await dashboard();
      setState({ loading: false, error: "", sources: data.sources });
    } catch (err) {
      setState({ loading: false, error: err.message, sources: [] });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.loading) return <p className="live-muted">Loading your dashboard…</p>;
  if (state.error) return <p className="live-error">We could not load your dashboard. <button className="link-btn" onClick={load}>Try again</button></p>;

  const nothingYet = state.sources.every((s) => !s.last_processed_at);
  return (
    <>
      <div className="live-toolbar"><button className="subtle-action" onClick={load}>Refresh</button></div>
      {nothingYet && (
        <div className="live-card live-empty">
          <strong>Your dashboard will appear after your first upload is processed.</strong>
          {canUpload
            ? <p>Go to <button className="link-btn" onClick={goUploads}>Data uploads</button>, download the template, add your data and upload it.</p>
            : <p>Ask an administrator to upload your first data file.</p>}
        </div>
      )}
      {state.sources.map((s) => (
        <section key={s.source} className="live-section">
          <h2>{s.source.replace(/_/g, " ")}
            <small>{s.last_processed_at ? `Last processed ${new Date(s.last_processed_at).toLocaleString("en-GB")}` : "Waiting for first upload"}</small>
          </h2>
          <div className="live-grid">{s.tiles.map((t) => <Tile key={t.id} tile={t} />)}</div>
        </section>
      ))}
    </>
  );
}
