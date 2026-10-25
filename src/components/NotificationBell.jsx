import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Bell, CheckCheck, MessageCircle, ClipboardCheck, LifeBuoy, AlertTriangle, RefreshCw } from "lucide-react";
import API from "../api/config";
import { getSocket } from "../services/socket";

/* =========================================================
   Real-time notifications
   • notification:new  → task assigned / reassigned / status / reminders / tickets
   • chat:message:new  → pop-up when you're not on the Chats page
   Shows a toast, updates the bell, and a desktop notification
   when the tab is in the background (if allowed).
========================================================= */

const ICONS = {
  task_assigned: ClipboardCheck,
  task_reassigned: RefreshCw,
  task_status: CheckCheck,
  task_reminder: AlertTriangle,
  task_overdue: AlertTriangle,
  support_ticket: LifeBuoy,
  support_reply: LifeBuoy,
  chat: MessageCircle,
};

const TITLES = {
  task_assigned: "New task assigned",
  task_reassigned: "Task reassigned",
  task_status: "Task status updated",
  task_reminder: "Task reminder",
  task_overdue: "Task deadline reached",
  support_ticket: "New support ticket",
  support_reply: "Support ticket update",
};

const linkFor = (n, role) => {
  if (n.type === "support_ticket") return role === "SuperAdmin" ? "/superadmin/dashboard" : "/dashboard/support";
  if (n.type === "support_reply") return "/dashboard/support";
  return "/dashboard/tasks";
};

const textOf = (n) =>
  n.type === "task_status" && n.actorName
    ? `${n.actorName} changed "${n.taskName}" ${n.fromStatus} → ${n.toStatus}`
    : n.message;

const timeAgo = (date) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(date).toLocaleDateString();
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const desktopNotify = (title, body, onClick) => {
  const user = getUser();
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (user?.preferences?.desktopNotifications === false) return; // Settings → Desktop notifications off
  if (!document.hidden) return; // the in-page toast is enough
  try {
    const n = new Notification(title, { body, tag: `${title}-${body}`.slice(0, 64) });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some browsers block constructor notifications */
  }
};

const NotificationBell = ({ buttonClassName = "header-action notification-button" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const wrapRef = useRef(null);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const load = useCallback(async () => {
    try {
      const res = await API.get("/api/notifications", { params: { limit: 20 } });
      setItems(res.data.data || []);
      setUnread(res.data.unread || 0);
    } catch {
      /* bell stays usable */
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return undefined;

    const onNotification = (n) => {
      // let open pages (Dashboard, Tasks) refresh their data
      window.dispatchEvent(new CustomEvent("realtime:notification", { detail: n }));
      setItems((prev) => [n, ...prev.filter((x) => x._id !== n._id)].slice(0, 30));
      setUnread((u) => u + 1);
      const title = TITLES[n.type] || "Notification";
      const body = textOf(n);
      const go = () => navigate(linkFor(n, getUser()?.role));
      const urgent = n.type === "task_overdue" || n.type === "task_reminder";
      (urgent ? toast.warn : toast.info)(
        <div style={{ cursor: "pointer" }}>
          <strong style={{ display: "block", fontSize: 13 }}>{title}</strong>
          <span style={{ fontSize: 12 }}>{body}</span>
        </div>,
        { onClick: go, autoClose: 7000, toastId: n._id }
      );
      desktopNotify(title, body, go);
    };

    const onChatMessage = (payload) => {
      if (pathRef.current.startsWith("/dashboard/chats")) return; // already looking at chat
      const msg = payload?.message || {};
      const from = msg.sender?.name || "Someone";
      const text = String(msg.text || (msg.attachments?.length ? "📎 Attachment" : "New message")).slice(0, 140);
      const go = () => navigate("/dashboard/chats");
      toast(
        <div style={{ cursor: "pointer" }}>
          <strong style={{ display: "block", fontSize: 13 }}>💬 {from}</strong>
          <span style={{ fontSize: 12 }}>{text}</span>
        </div>,
        { onClick: go, autoClose: 6000, toastId: `chat-${msg._id || Date.now()}` }
      );
      desktopNotify(`New message from ${from}`, text, go);
    };

    socket.on("notification:new", onNotification);
    socket.on("chat:message:new", onChatMessage);
    socket.on("connect", load); // catch up after reconnecting
    return () => {
      socket.off("notification:new", onNotification);
      socket.off("chat:message:new", onChatMessage);
      socket.off("connect", load);
    };
  }, [load, navigate]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markAll = async () => {
    try {
      await API.patch("/api/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      API.patch(`/api/notifications/${n._id}/read`).catch(() => {});
    }
    navigate(linkFor(n, getUser()?.role));
  };

  const askDesktop = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      // keep Settings → "Desktop notifications" in sync
      try {
        await API.put("/api/auth/me/preferences", { desktopNotifications: true });
        const u = getUser();
        if (u) localStorage.setItem("user", JSON.stringify({ ...u, preferences: { ...(u.preferences || {}), desktopNotifications: true } }));
      } catch {
        /* permission still granted */
      }
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={17} strokeWidth={2} />
        {unread > 0 && (
          <>
            <span style={styles.badge}>{unread > 99 ? "99+" : unread}</span>
            <span className="notification-pulse" />
          </>
        )}
      </button>

      {open && (
        <div style={styles.panel} role="dialog" aria-label="Notifications">
          <div style={styles.head}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" style={styles.link} onClick={markAll}>Mark all read</button>
            )}
          </div>
          {permission === "default" && (
            <button type="button" style={styles.enable} onClick={askDesktop}>
              🔔 Turn on desktop alerts (when this tab is in the background)
            </button>
          )}
          <div style={styles.list}>
            {items.length === 0 && <div style={styles.empty}>You're all caught up.</div>}
            {items.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button
                  type="button"
                  key={n._id}
                  onClick={() => openItem(n)}
                  style={{ ...styles.item, background: n.read ? "#fff" : "#F2FBFC" }}
                >
                  <span style={styles.icon}><Icon size={14} /></span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={styles.title}>{TITLES[n.type] || "Notification"}</span>
                    <span style={styles.text}>{textOf(n)}</span>
                    <span style={styles.time}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span style={styles.dot} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 999,
    background: "#e11d48", color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: "17px", textAlign: "center",
    boxShadow: "0 0 0 2px #fff",
  },
  panel: {
    position: "absolute", right: 0, top: "calc(100% + 10px)", width: 360, maxWidth: "calc(100vw - 24px)", zIndex: 1200,
    background: "#fff", borderRadius: 16, border: "1px solid #D5E7EE", boxShadow: "0 24px 60px rgba(6,59,70,.18)", overflow: "hidden",
  },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid #EEF5F6", fontSize: 14, color: "#123B5D" },
  link: { border: "none", background: "transparent", color: "#0b8f87", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  enable: { width: "100%", border: "none", borderBottom: "1px solid #EEF5F6", background: "#FFFBF0", color: "#8a5a00", fontSize: 12, padding: "9px 14px", cursor: "pointer", textAlign: "left" },
  list: { maxHeight: 420, overflowY: "auto" },
  empty: { padding: 20, fontSize: 13, color: "#6E8799", textAlign: "center" },
  item: { width: "100%", display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", border: "none", borderBottom: "1px solid #F1F6F8", cursor: "pointer" },
  icon: { width: 28, height: 28, flexShrink: 0, borderRadius: 9, background: "#E8F7F8", color: "#0b8f87", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { display: "block", fontSize: 12, fontWeight: 800, color: "#123B5D" },
  text: { display: "block", fontSize: 12, color: "#3d5a68", lineHeight: 1.4, marginTop: 1, wordBreak: "break-word" },
  time: { display: "block", fontSize: 10, color: "#8aa1ad", marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#16A6B8", marginTop: 6, flexShrink: 0 },
};

export default NotificationBell;
