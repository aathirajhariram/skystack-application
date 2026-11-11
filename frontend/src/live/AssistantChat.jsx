import { useEffect, useRef, useState } from "react";
import { Bot, LifeBuoy, MessageCircle, Send, X } from "lucide-react";
import { askAssistant } from "../auth/api.js";

// Same look as the demo's support chat (styles.css), but answers come from Claude, grounded in this workspace.
const QUICK = [
  ["Summarise my dashboard", "Give me a short summary of what my dashboard shows right now and anything that stands out."],
  ["Check my last uploads", "How did my recent uploads and processing runs go? Is anything wrong?"],
  ["Draft a customer email", "Help me draft a short email to a customer based on what my data shows. Ask me who it is for."],
];

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi, I'm the SkyStack assistant. I can explain your dashboard, check your uploads, and draft emails or WhatsApp messages for you to send. What would you like to know?" }]);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, open]);

  async function send(text = input) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await askAssistant(next.slice(1));                 // the greeting is not part of the conversation
      setMsgs([...next, { role: "assistant", content: r.reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: e.message && e.message !== "request_failed" ? e.message : "Sorry, I could not answer that. Please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className={`support-chat ${open ? "support-chat-open" : ""}`}>
      {open && (
        <section className="support-chat-panel" aria-label="SkyStack assistant">
          <header className="support-chat-header">
            <span className="support-bot-avatar"><Bot size={19} /></span>
            <div><strong>SkyStack assistant</strong><small><i /> Answers from your own workspace</small></div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button>
          </header>
          <div className="support-chat-messages" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`support-chat-message ${m.role === "user" ? "from-user" : "from-bot"}`}>
                {m.role === "assistant" && <span className="chat-message-avatar"><Bot size={13} /></span>}
                <p style={{ whiteSpace: "pre-wrap" }}>{m.content}</p>
              </div>
            ))}
            {busy && <div className="support-chat-message from-bot"><span className="chat-message-avatar"><Bot size={13} /></span><p>Thinking…</p></div>}
            <div ref={end} />
          </div>
          {msgs.length === 1 && (
            <div className="support-quick-questions">
              {QUICK.map(([label, q]) => <button key={label} onClick={() => send(q)}>{label}</button>)}
            </div>
          )}
          <form className="support-chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your data or the portal…" aria-label="Ask the assistant" maxLength={2000} />
            <button type="submit" aria-label="Send message" disabled={!input.trim() || busy}><Send size={16} /></button>
          </form>
          <a className="support-chat-contact" href="https://www.skystack.global/contact"><LifeBuoy size={14} /> Contact a specialist</a>
          <div className="support-chat-disclaimer">AI assistant · it can read your workspace figures but cannot send messages or change anything. Check important details.</div>
        </section>
      )}
      <button className="support-chat-launcher" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close assistant" : "Open assistant"}>
        {open ? <X size={23} /> : (<><MessageCircle size={21} /><span>Ask SkyStack</span></>)}
      </button>
    </div>
  );
}
