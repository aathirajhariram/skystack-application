import { useState } from "react";
import { changePassword } from "../auth/api.js";

// Used twice: the forced first-login screen (one-time password) and Account > Change password.
export default function ChangePasswordForm({ forced = false, onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next !== again) return setError("The two new passwords do not match.");
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent(""); setNext(""); setAgain("");
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="live-form" onSubmit={submit}>
      <label>
        {forced ? "One-time password (from your email)" : "Current password"}
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        New password
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      </label>
      <label>
        Repeat new password
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
      </label>
      <small className="live-hint">At least 12 characters, mixing at least three of: lowercase, uppercase, numbers, symbols.</small>
      {error && <p className="live-error" role="alert">{error}</p>}
      {done && !forced && <p className="live-ok" role="status">Your password was changed.</p>}
      <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : forced ? "Set my password" : "Change password"}</button>
    </form>
  );
}
