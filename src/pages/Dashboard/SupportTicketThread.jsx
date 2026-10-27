import React, { useState } from "react";
import { Loader2, Send, ShieldCheck, UserRound } from "lucide-react";
import API from "../../api/config";

/* =========================================================
   Ticket conversation (user ⇄ support team).
   Used on the Support page (ticket owner) and the
   Super Admin dashboard (support team).
========================================================= */

// FIX: full backend address so replies work no matter how
// src/api/config.js sets its baseURL (with or without /api).
// Axios ignores baseURL when the URL is absolute; the token interceptor still runs.
const API_BASE =
  String(import.meta.env.VITE_API_URL || "https://task-backend-mn8a.onrender.com")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "") + "/api";

const STAFF_ROLES = ["SuperAdmin", "Admin"];

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

const SupportTicketThread = ({ ticket, staff = false, onUpdated }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const responses = ticket.responses || [];

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await API.post(`${API_BASE}/support/tickets/${ticket._id}/reply`, {
        message: message.trim(),
      });
      setMessage("");
      onUpdated?.(res.data?.data || res.data);
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 401
          ? "Session expired. Please log in again."
          : status === 404
          ? "Reply route not found on the server (POST /api/support/tickets/:id/reply)."
          : !err.response
          ? "Cannot reach the server. Please try again."
          : err.response?.data?.message || "Reply could not be sent."
      );
    } finally {
      setSending(false);
    }
  };

  // Enter sends, Shift+Enter adds a new line
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e);
    }
  };

  return (
    <div style={styles.wrap}>
      <style>{`@keyframes stt-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ ...styles.bubble, ...styles.userBubble }}>
        <div style={styles.who}>
          <UserRound size={12} /> {ticket.raisedBy?.name || "You"} · {formatDate(ticket.createdAt)}
        </div>
        <div style={styles.text}>{ticket.message}</div>
      </div>

      {responses.map((r, i) => {
        const fromStaff = STAFF_ROLES.includes(r.byRole);
        return (
          <div key={r._id || i} style={{ ...styles.bubble, ...(fromStaff ? styles.staffBubble : styles.userBubble) }}>
            <div style={styles.who}>
              {fromStaff ? <ShieldCheck size={12} /> : <UserRound size={12} />}
              {r.byName || (fromStaff ? "Support" : "User")}
              {fromStaff ? " (Support)" : ""} · {formatDate(r.at)}
            </div>
            <div style={styles.text}>{r.message}</div>
          </div>
        );
      })}

      <form onSubmit={send} style={styles.form}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={staff ? "Write a reply to the user…" : "Add more details or reply to support…"}
          rows={2}
          maxLength={3000}
          style={styles.input}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          style={{ ...styles.send, opacity: sending || !message.trim() ? 0.6 : 1 }}
        >
          {sending ? (
            <Loader2 size={13} style={{ animation: "stt-spin .9s linear infinite" }} />
          ) : (
            <Send size={13} />
          )}{" "}
          {sending ? "Sending…" : staff ? "Reply" : "Send"}
        </button>
      </form>
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 },
  bubble: { padding: "9px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5, maxWidth: "92%" },
  userBubble: { background: "#F4F8FA", border: "1px solid #E1ECF0", alignSelf: "flex-start" },
  staffBubble: { background: "#ECFEFF", border: "1px solid #BDEFF5", alignSelf: "flex-end" },
  who: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#5f7d89", marginBottom: 3 },
  text: { whiteSpace: "pre-wrap", color: "#123B5D" },
  form: { display: "flex", gap: 8, alignItems: "flex-end", marginTop: 4 },
  input: { flex: 1, resize: "vertical", border: "1px solid #D5E7EE", borderRadius: 10, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" },
  send: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10, padding: "9px 14px", background: "linear-gradient(135deg,#06b6d4,#14b8a6)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  error: { fontSize: 12, color: "#be123c" },
};

export default SupportTicketThread;
