import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Check, Database, Headphones, ShieldCheck, Sparkles, Upload, Users, X, Zap } from "lucide-react";
import { publicIndustries, publicPlans, subscribe } from "../auth/api.js";
import "./subscribe.css";

// Any button can open this popup:  window.dispatchEvent(new CustomEvent("skystack:subscribe", { detail: { plan: "pro" } }))
export const openSubscribe = (plan) => window.dispatchEvent(new CustomEvent("skystack:subscribe", { detail: { plan } }));

const FALLBACK_INDUSTRIES = ["logistics", "manufacturing", "real_estate", "construction", "marketing", "advertising", "legal"];
// The plan price is the price of one billing period, which lasts p.months months (3 by default).
const months = (p) => p.months || 3;
const periodLabel = (p) => (months(p) === 1 ? "month" : `${months(p)} months`);
const money = (p) => new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency, maximumFractionDigits: 0 }).format(p.price);
// Shown when the plans service cannot be reached (for example before the backend is deployed).
// The live prices and features always come from cfg.Plan once the API answers.
const DEFAULT_PLANS = [
  { code: "basic", name: "Basic", price: 99, currency: "EUR", tagline: "For small teams getting started", popular: false,
    features: ["1 data source", "Up to 3 users", "Monthly dashboard refresh", "Email support"] },
  { code: "pro", name: "Pro", price: 249, currency: "EUR", tagline: "For growing companies", popular: true,
    features: ["Up to 5 data sources", "Up to 15 users", "Daily dashboard refresh", "Role-based access for employees", "Priority support"] },
  { code: "elite", name: "Elite", price: 499, currency: "EUR", tagline: "For data-driven organisations", popular: false,
    features: ["Unlimited data sources", "Up to 50 users", "Refresh on every upload", "Dedicated specialist and onboarding call", "Custom dashboards"] },
];
const FEATURE_ICONS = [Database, Users, BarChart3, Upload, ShieldCheck, Zap, Headphones, Sparkles];
const label = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function SubscribeHost() {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [live, setLive] = useState(false);
  const [industries, setIndustries] = useState(FALLBACK_INDUSTRIES);
  const [plan, setPlan] = useState("");
  const [step, setStep] = useState("plans");
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", industry: "logistics", website: "" });
  const [state, setState] = useState({ busy: false, error: "", done: false });
  const first = useRef(null);

  useEffect(() => {
    const onOpen = (e) => { setOpen(true); setStep("plans"); setState({ busy: false, error: "", done: false }); if (e.detail?.plan) setPlan(e.detail.plan); };
    window.addEventListener("skystack:subscribe", onOpen);
    return () => window.removeEventListener("skystack:subscribe", onOpen);
  }, []);

  useEffect(() => {
    if (!open || live) return;
    publicPlans().then((p) => { setLive(true); setPlans(p); setPlan((cur) => cur || p.find((x) => x.popular)?.code || p[0]?.code || ""); }).catch(() => { setPlan((cur) => cur || "pro"); });
    publicIndustries().then(setIndustries).catch(() => {});
  }, [open, live]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    first.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!plan) return setState({ busy: false, error: "Please choose a plan.", done: false });
    setState({ busy: true, error: "", done: false });
    try {
      await subscribe({ ...form, plan });
      setState({ busy: false, error: "", done: true });
    } catch (err) {
      const msg = err.status === 429 ? "Too many requests. Please try again later." : err.status === 0 || err.status >= 500 ? "We could not reach the subscription service. Please try again shortly." : err.code === "csrf" ? "Something went wrong. Please reload the page." : err.message;
      setState({ busy: false, error: msg, done: false });
    }
  }

  const chosen = plans.find((p) => p.code === plan);
  const pick = (code) => { setPlan(code); setStep("details"); setState((s) => ({ ...s, error: "" })); };

  return (
    <div className="sub-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className={`sub-dialog ${step === "plans" && !state.done ? "sub-wide" : "sub-narrow"}`} role="dialog" aria-modal="true" aria-labelledby="sub-title">
        <button className="sub-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
        {state.done ? (
          <div className="sub-done">
            <span className="sub-done-icon"><Check size={26} /></span>
            <h2 id="sub-title">Check your inbox</h2>
            <p>We have emailed you a secure payment link for the <b>{chosen?.name}</b> plan.
              Once your payment is confirmed, you will receive a one-time password to sign in with <b>{form.email}</b>.</p>
            <button className="sub-cta sub-cta-primary" onClick={() => setOpen(false)}>Close</button>
          </div>
        ) : step === "plans" ? (
          <>
            <h2 id="sub-title" className="sub-title-center">Choose your plan</h2>
            <p className="sub-lead sub-center">Your private data workspace, dashboards and secure uploads. Upgrade or cancel any time.</p>
            {plans.length === 0 && !state.error && <p className="sub-muted sub-center">Loading plans…</p>}
            {state.error && plans.length === 0 && <p className="sub-error sub-center" role="alert">{state.error}</p>}
            <div className="sub-plans">
              {plans.map((p) => (
                <section key={p.code} className={`sub-plan ${p.popular ? "recommended" : ""}`} aria-label={`${p.name} plan`}>
                  <header>
                    <h3>{p.name}</h3>
                    {p.popular && <em className="sub-badge">RECOMMENDED</em>}
                  </header>
                  <p className="sub-plan-title">{p.tagline}</p>
                  <button type="button" className={`sub-cta ${p.popular ? "sub-cta-primary" : "sub-cta-outline"}`} onClick={() => pick(p.code)}>
                    {p.popular && <Sparkles size={15} />} Subscribe to {p.name}
                  </button>
                  <div className="sub-price"><sup>€</sup>{Math.round(p.price)}<small> / {periodLabel(p)}</small></div>
                  <ul>
                    {p.features.map((f, i) => { const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]; return <li key={f}><Icon size={17} />{f}</li>; })}
                  </ul>
                </section>
              ))}
            </div>
            <small className="sub-muted sub-center sub-foot">Taxes may apply at checkout. After subscribing you receive a secure payment link by email.</small>
          </>
        ) : (
          <form onSubmit={submit}>
            <button type="button" className="sub-back" onClick={() => setStep("plans")}><ArrowLeft size={15} /> All plans</button>
            <h2 id="sub-title">Subscribe to {chosen?.name}</h2>
            <p className="sub-lead">{chosen ? `${money(chosen)} / ${periodLabel(chosen)}` : ""} · {chosen?.tagline}</p>
            <div className="sub-fields">
              <label>Company<input ref={first} value={form.company_name} onChange={set("company_name")} required minLength={2} autoComplete="organization" /></label>
              <label>Your name<input value={form.contact_name} onChange={set("contact_name")} required minLength={2} autoComplete="name" /></label>
              <label>Work email (this will be your login)<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
              <label>Industry<select value={form.industry} onChange={set("industry")}>{industries.map((i) => <option key={i} value={i}>{label(i)}</option>)}</select></label>
              <input className="sub-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} />
            </div>
            {state.error && <p className="sub-error" role="alert">{state.error}</p>}
            <button className="sub-cta sub-cta-primary sub-submit" disabled={state.busy || !plans.length}>{state.busy ? "Sending…" : "Subscribe and get payment link"}</button>
            <small className="sub-muted">We will email you a payment link. After payment you receive a one-time password to sign in.</small>
          </form>
        )}
      </div>
    </div>
  );
}
