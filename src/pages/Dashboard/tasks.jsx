import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import CsvImportDialog from "../../components/CsvImportDialog";
import {
  Plus,
  X,
  Search,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Circle,
  UserRound,
  Building2,
  Paperclip,
  ListChecks,
  RotateCcw,
  Award,
  FileText,
  Trash2,
  Eye,
  ArrowDown,
  Minus,
  ArrowUp,
  ShieldAlert,
  LogIn,
  Rows3,
  Columns3,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Target,
  Waves,
  Zap,
  MoreHorizontal,
  Download,
  UploadCloud,
  Upload,
} from "lucide-react";

/* =========================================================
   THEME
========================================================= */

const colors = {
  navy: "#123B5D",
  navyDark: "#082A45",
  blue: "#1677A8",
  blueLight: "#E6F4FA",
  ocean: "#16A6B8",
  oceanDark: "#08798C",
  oceanSoft: "#E7F8FA",
  border: "#D5E7EE",
  text: "#16344D",
  muted: "#6E8799",
  white: "#FFFFFF",
  background: "#F2F8FA",
};

/* =========================================================
   API SETUP
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Same rules the backend enforces — used only to hide actions the user cannot perform
const getSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const canDo = (user, moduleId, action) =>
  user?.role === "SuperAdmin" ||
  Boolean(user?.permissions?.[moduleId]?.includes(action));

// Creator, Manager or Admin may edit/delete; assignees only change status
const canModifyTask = (user, task) => {
  if (!user) return false;
  if (["SuperAdmin", "Admin", "Manager"].includes(user.role)) return true;
  return Boolean(task?.assignedBy) && String(task.assignedBy) === String(user._id);
};

/* =========================================================
   ATTACHMENT RULES (mirror backend/src/controllers/taskController.js)
========================================================= */

const ATTACHMENT_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx",
  "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip",
];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileExtension = (name = "") =>
  String(name).split(".").pop().toLowerCase();

// Authenticated download (the files are not public)
const downloadAttachment = async (attachment) => {
  const response = await api.get(
    `/tasks/attachments/${encodeURIComponent(attachment.filename)}`,
    { responseType: "blob" }
  );
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name || attachment.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("jwt") ||
  localStorage.getItem("userToken") ||
  "";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* =========================================================
   RESPONSE HELPERS
========================================================= */

const extractApiData = (response) => {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.users)) return body.users;
  if (Array.isArray(body?.departments)) return body.departments;

  return [];
};

const extractTaskList = (response) => {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.tasks)) return body.tasks;

  return [];
};

const extractCreatedTask = (response) => {
  const body = response?.data;

  return (
    body?.data ||
    body?.task ||
    body?.updatedTask ||
    body
  );
};

/* =========================================================
   NORMALIZERS
========================================================= */

const normalizeDepartment = (item) => {
  if (typeof item === "string") {
    return {
      id: item,
      name: item,
    };
  }

  return {
    id: item?._id || item?.id || item?.name,
    name:
      item?.name ||
      item?.departmentName ||
      item?.title ||
      item?.department ||
      "",
  };
};

const normalizeUser = (item) => ({
  id: item?._id || item?.id || item?.email,

  name:
    item?.name ||
    item?.fullName ||
    item?.username ||
    item?.userName ||
    item?.email ||
    "Unnamed User",

  email: item?.email || "",

  department:
    typeof item?.department === "object"
      ? item.department?.name ||
        item.department?.departmentName ||
        ""
      : item?.department || "",

  status: item?.status || "Active",
});

const normalizeStatus = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  const aliases = {
    "to do": "To Do",
    todo: "To Do",
    "to-do": "To Do",
    "to_do": "To Do",
    pending: "To Do",
    new: "To Do",

    "in progress": "In Progress",
    inprogress: "In Progress",
    "in-progress": "In Progress",
    "in_progress": "In Progress",
    progress: "In Progress",
    active: "In Progress",
    ongoing: "In Progress",

    review: "Review",
    reviewing: "Review",
    "in review": "Review",
    "under review": "Review",

    completed: "Completed",
    complete: "Completed",
    done: "Completed",
    finished: "Completed",
  };

  return aliases[raw] || "To Do";
};

const normalizeTask = (t) => ({
  id:
    t?._id ||
    t?.id ||
    `tmp-${Date.now()}-${Math.random()}`,

  rawStatus: t?.status ?? "",

  assignedTo:
    typeof t?.assignedTo === "object"
      ? t?.assignedTo?._id || ""
      : t?.assignedTo || "",

  assignedBy:
    typeof t?.assignedBy === "object"
      ? t?.assignedBy?._id || ""
      : t?.assignedBy || "",

  dueTime: t?.dueTime || "",

  name:
    t?.name ||
    t?.title ||
    "Untitled Task",

  referenceId:
    t?.referenceId || "",

  department:
    typeof t?.department === "object"
      ? t?.department?.name ||
        t?.department?.departmentName ||
        ""
      : t?.department || "",

  assignedUser:
    typeof t?.assignedUser === "object"
      ? t?.assignedUser?.name ||
        t?.assignedUser?.fullName ||
        ""
      : t?.assignedUser || "",

  assignedUsers: Array.isArray(t?.assignedUsers)
    ? t.assignedUsers.map((user) =>
        typeof user === "object"
          ? user?.name || user?.fullName || user?.username || ""
          : user
      ).filter(Boolean)
    : (t?.assignedUser
        ? [typeof t.assignedUser === "object"
            ? t.assignedUser?.name || t.assignedUser?.fullName || ""
            : t.assignedUser]
        : []),

  description:
    t?.description || "",

  dueDate:
    t?.dueDate
      ? String(t.dueDate).slice(0, 10)
      : "",

  priority:
    t?.priority || "Medium",

  complexity:
    t?.complexity ?? 0,

  reward:
    t?.reward ?? 10,

  recurring:
    Boolean(t?.recurring),

  recurrenceInterval:
    t?.recurrenceInterval ||
    "Every day",

  attachments:
    Array.isArray(t?.attachments)
      ? t.attachments
      : [],

  subtasks:
    Array.isArray(t?.subtasks)
      ? t.subtasks
      : [],

  status:
    normalizeStatus(t?.status),

  createdAt:
    t?.createdAt || "",
});

const normalizeAttachmentForForm = (a) => {
  if (typeof a === "string") {
    return {
      name: a,
      size: 0,
    };
  }

  return {
    name:
      a?.name ||
      a?.filename ||
      a?.originalName ||
      a?.url ||
      "attachment",

    size: a?.size || 0,
    type: a?.mimetype || "",
    filename: a?.filename || "",
    downloadable: Boolean(a?.filename),
    existing: true,
  };
};

const normalizeSubtaskForForm = (s, index) => {
  if (typeof s === "string") {
    return {
      id: `sub-${index}-${Date.now()}`,
      title: s,
    };
  }

  return {
    id:
      s?._id ||
      s?.id ||
      `sub-${index}-${Date.now()}`,

    title:
      s?.title ||
      s?.name ||
      "",
  };
};

/* =========================================================
   TASK API
========================================================= */

const fetchTasksApi = async () => {
  const response = await api.get("/tasks");
  return extractTaskList(response);
};

const createTaskApi = async (payload) => {
  const response = await api.post("/tasks", payload);
  return extractCreatedTask(response);
};

// Backend: PATCH /api/tasks/:id (JSON or multipart/form-data)
const updateTaskApi = async (taskId, payload) => {
  const response = await api.patch(
    `/tasks/${taskId}`,
    payload
  );

  return extractCreatedTask(response);
};

/* =========================================================
   STATUS UPDATE
========================================================= */

const STATUS_VALUE_OVERRIDE = {
  // "To Do": "todo",
  // "In Progress": "in-progress",
  // Review: "review",
  // Completed: "completed",
};

// Backend route: PATCH /api/tasks/:id/status { status }
const STATUS_ROUTE_OVERRIDE = "/tasks/{id}/status";

const STATUS_VALUE_VARIANTS = (
  canonical,
  rawHint
) => {
  const values = [];

  const push = (value) => {
    if (
      value &&
      !values.includes(value)
    ) {
      values.push(value);
    }
  };

  if (
    STATUS_VALUE_OVERRIDE[canonical]
  ) {
    push(
      STATUS_VALUE_OVERRIDE[canonical]
    );
  }

  push(canonical);
  push(
    canonical.toLowerCase()
  );

  push(
    canonical
      .toLowerCase()
      .replace(/\s+/g, "-")
  );

  push(
    canonical
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  push(
    canonical
      .toLowerCase()
      .replace(/\s+/g, "")
  );

  push(rawHint);

  return values;
};

const STATUS_ROUTES = (taskId) => {
  if (STATUS_ROUTE_OVERRIDE) {
    return [
      STATUS_ROUTE_OVERRIDE.replace(
        "{id}",
        taskId
      ),
    ];
  }

  return [
    `/tasks/${taskId}`,
    `/tasks/${taskId}/status`,
  ];
};

const STATUS_METHODS = [
  "patch",
  "put",
];

let statusRecipe = null;

const responseConfirmsNewStatus = (
  result,
  canonical
) => {
  if (typeof result === "string") {
    return false;
  }

  if (
    !result ||
    typeof result !== "object"
  ) {
    return true;
  }

  const returned =
    result.status ??
    result.taskStatus ??
    result.task?.status;

  if (
    returned === undefined ||
    returned === null ||
    returned === ""
  ) {
    return true;
  }

  return (
    normalizeStatus(returned) ===
    canonical
  );
};

const attemptStatusUpdate = (
  method,
  route,
  value
) => {
  const request =
    method === "put"
      ? api.put
      : api.patch;

  console.log(
    `[Status] ${method.toUpperCase()} ${API_URL}${route} → ${value}`
  );

  return request(route, {
    status: value,
    taskStatus: value,
  }).then((response) =>
    extractCreatedTask(response)
  );
};

const updateTaskStatusApi = async (
  taskId,
  status,
  rawHint = ""
) => {
  const canonical =
    normalizeStatus(status);

  const attempts = [];

  const runCandidate = async (
    method,
    route,
    value
  ) => {
    try {
      const result =
        await attemptStatusUpdate(
          method,
          route,
          value
        );

      if (
        !responseConfirmsNewStatus(
          result,
          canonical
        )
      ) {
        const error =
          new Error(
            `Server returned a different status.`
          );

        error.softMismatch = true;

        throw error;
      }

      statusRecipe = {
        method,
        routeTemplate:
          route.replace(
            taskId,
            "{id}"
          ),
        value,
      };

      console.log(
        `[Status] ✔ Saved ${canonical}`
      );

      return result;
    } catch (err) {
      attempts.push(
        `${method.toUpperCase()} ${route} "${value}" → ${
          err?.response?.status ||
          err.message
        }`
      );

      throw err;
    }
  };

  if (statusRecipe) {
    try {
      return await runCandidate(
        statusRecipe.method,
        statusRecipe.routeTemplate.replace(
          "{id}",
          taskId
        ),
        statusRecipe.value
      );
    } catch (err) {
      if (
        err?.response?.status ===
        401
      ) {
        throw err;
      }

      statusRecipe = null;
    }
  }

  for (const value of STATUS_VALUE_VARIANTS(
    canonical,
    rawHint
  )) {
    for (const route of STATUS_ROUTES(
      taskId
    )) {
      for (const method of STATUS_METHODS) {
        try {
          return await runCandidate(
            method,
            route,
            value
          );
        } catch (err) {
          if (
            err?.response?.status ===
            401
          ) {
            throw new Error(
              "Session expired. Please log in again."
            );
          }

          const code =
            err?.response?.status;

          const retryable =
            code === 400 ||
            code === 404 ||
            code === 405 ||
            code === 422 ||
            err?.softMismatch;

          if (!retryable) {
            throw err;
          }
        }
      }
    }
  }

  console.error(
    "[Status] All attempts failed",
    attempts
  );

  throw new Error(
    `Could not save status "${canonical}".`
  );
};

const deleteTaskApi = async (
  taskId
) => {
  return api.delete(
    `/tasks/${taskId}`
  );
};

/* =========================================================
   SEMANTIC CONFIG
========================================================= */

const TASK_STATUSES = [
  "To Do",
  "In Progress",
  "Review",
  "Completed",
];

const priorityConfig = {
  Low: {
    icon: ArrowDown,
    color: "#2F6F91",
    background: "#EEF7FA",
  },

  Medium: {
    icon: Minus,
    color: "#B7791F",
    background: "#FFF7E6",
  },

  High: {
    icon: ArrowUp,
    color: "#C65D38",
    background: "#FFF0EA",
  },

  Critical: {
    icon: ShieldAlert,
    color: "#A83C55",
    background: "#FDECEF",
  },
};

const statusConfig = {
  "To Do": {
    color: "#54758F",
    background: "#EEF5F8",
    soft: "#F5FAFC",
    icon: Circle,
    progress: 15,
    description: "Ready to start",
  },

  "In Progress": {
    color: "#247DA6",
    background: "#EAF5FA",
    soft: "#F3FAFD",
    icon: Clock3,
    progress: 48,
    description: "Currently active",
  },

  Review: {
    color: "#A66B24",
    background: "#FFF6E7",
    soft: "#FFFBF3",
    icon: Eye,
    progress: 76,
    description: "Awaiting review",
  },

  Completed: {
    color: "#188A75",
    background: "#E9F8F4",
    soft: "#F2FCF9",
    icon: CheckCircle2,
    progress: 100,
    description: "Successfully completed",
  },
};

/* =========================================================
   GLOBAL CSS
========================================================= */

const globalCss = `
@keyframes ts-spin {
  to { transform: rotate(360deg); }
}

@keyframes ts-float {
  0%,100% {
    transform: translate3d(0,0,0) rotate(0deg);
  }

  50% {
    transform: translate3d(0,-18px,0) rotate(5deg);
  }
}

@keyframes ts-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ts-pop {
  0% {
    opacity: 0;
    transform: scale(.94);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ts-glow {
  0%,100% {
    opacity: .45;
  }

  50% {
    opacity: 1;
  }
}

@keyframes ts-wave {
  0% {
    transform: translateX(-10%) translateY(0);
  }

  50% {
    transform: translateX(5%) translateY(-8px);
  }

  100% {
    transform: translateX(-10%) translateY(0);
  }
}

@keyframes ts-flow-wave {
  to {
    stroke-dashoffset: -.115;
  }
}

@keyframes ts-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(22,166,184,.25);
  }

  70% {
    box-shadow: 0 0 0 12px rgba(22,166,184,0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(22,166,184,0);
  }
}

@keyframes ts-shimmer {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(120%);
  }
}

@keyframes ts-status {
  0% {
    transform: scaleX(.2);
    opacity: .35;
  }

  100% {
    transform: scaleX(1);
    opacity: 1;
  }
}

.task-page-unique {
  font-family:
    "Inter",
    "Segoe UI",
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

.task-page-unique button,
.task-page-unique input,
.task-page-unique select,
.task-page-unique textarea {
  font-family: inherit;
}

.ts-floating-dot {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(
      circle at 30% 25%,
      rgba(255,255,255,.95),
      rgba(255,255,255,.08)
    );
  opacity: .3;
  animation:
    ts-float 6s ease-in-out infinite;
}

.ts-hero-grid {
  position: absolute;
  inset: 0;
  opacity: .12;
  pointer-events: none;
  background-image:
    linear-gradient(
      rgba(255,255,255,.2) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      rgba(255,255,255,.2) 1px,
      transparent 1px
    );
  background-size: 30px 30px;
  mask-image: linear-gradient(
    90deg,
    transparent,
    black,
    transparent
  );
}

.ts-wave-line {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -24px;
  height: 70px;
  border-radius: 50%;
  border-top: 1px solid rgba(255,255,255,.18);
  animation: ts-wave 8s ease-in-out infinite;
}

.ts-stat-card {
  position: relative;
  overflow: hidden;
  animation:
    ts-rise .55s ease both;
  transition:
    transform .25s ease,
    box-shadow .25s ease,
    border-color .25s ease;
}

.ts-stat-card:hover {
  transform:
    translateY(-6px)
    scale(1.01);
  box-shadow:
    0 20px 42px
    rgba(18,59,93,.13);
}

.ts-stat-card::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,.7),
      transparent
    );
  transform: skewX(-18deg);
  transition: none;
  pointer-events: none;
}

.ts-stat-card:hover::after {
  animation:
    ts-shimmer .8s ease;
}

.ts-stat-orb {
  position: absolute;
  width: 130px;
  height: 130px;
  right: -44px;
  top: -48px;
  border-radius: 50%;
  background: var(--stat-soft);
}

.ts-stat-orb-two {
  position: absolute;
  width: 72px;
  height: 72px;
  right: 38px;
  bottom: -30px;
  border-radius: 50%;
  background: var(--stat-soft);
}

.ts-stat-watermark {
  position: absolute;
  right: 12px;
  bottom: 4px;
  opacity: .07;
  color: var(--stat-accent);
  pointer-events: none;
}

.ts-stat-progress {
  position: relative;
}

.ts-stat-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 45%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255,255,255,.72),
    transparent
  );
  transform: translateX(-120%);
  animation: ts-shimmer 2.8s ease-in-out infinite;
  pointer-events: none;
}

.ts-pipeline-wave {
  position: relative;
}

.ts-pipeline-wave-svg {
  width: 100%;
  height: 32px;
  overflow: visible;
}

.ts-pipeline-wave-svg path {
  fill: none;
  stroke: #8ACFDB;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: .08 .035;
  animation: ts-flow-wave 2.6s linear infinite;
  filter: drop-shadow(0 2px 4px rgba(22,166,184,.18));
}

.ts-search-card,
.ts-workspace-card {
  animation:
    ts-rise .55s ease both;
}

.ts-task-card {
  animation:
    ts-rise .48s ease both;
  transition:
    transform .22s ease,
    box-shadow .22s ease,
    border-color .22s ease;
}

.ts-task-card:hover {
  transform:
    translateY(-4px)
    translateX(2px);
  box-shadow:
    0 16px 34px
    rgba(18,59,93,.12);
}

.ts-task-card:hover .ts-task-accent {
  width: 6px !important;
}

.ts-task-accent {
  transition:
    width .25s ease;
}

.ts-pipeline {
  animation:
    ts-rise .55s ease both;
}

.ts-pipeline-step {
  transition:
    transform .2s ease,
    box-shadow .2s ease;
}

.ts-pipeline-step:hover {
  transform: translateY(-3px);
}

.ts-pipeline-dot {
  animation:
    ts-pulse 2.5s infinite;
}

.ts-modal {
  animation:
    ts-pop .25s ease both;
}

.ts-modal-content {
  animation:
    ts-rise .3s ease both;
}

.ts-action-button {
  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.ts-action-button:hover {
  transform: translateY(-2px);
}

.ts-refresh:hover {
  transform: rotate(180deg);
}

.ts-refresh {
  transition:
    transform .45s ease,
    background .2s ease;
}

@media (max-width: 900px) {
  .ts-task-right {
    width: 100% !important;
    justify-content: flex-start !important;
  }
}

@media (max-width: 650px) {
  .ts-page {
    padding: 14px !important;
  }

  .ts-hero {
    padding: 22px !important;
  }

  .ts-hero-title {
    font-size: 21px !important;
  }

  .ts-pipeline {
    overflow-x: auto;
  }

  .ts-pipeline-track {
    min-width: 650px;
  }

  .ts-task-main {
    flex-direction: column !important;
  }

  .ts-task-right {
    flex-direction: row !important;
  }

  .ts-modal-overlay {
    padding: 8px !important;
  }

  .ts-modal {
    max-height: 96vh !important;
  }
}
`;

/* =========================================================
   STYLES
========================================================= */

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 5% 0%, rgba(22,166,184,.08), transparent 25%), #F2F8FA",
    padding: "24px 28px 60px",
    boxSizing: "border-box",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(125deg, #071F34 0%, #0B3553 42%, #123B5D 72%, #1677A8 125%)",
    borderRadius: 24,
    padding: "28px 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: colors.white,
    boxShadow:
      "0 24px 55px rgba(8,42,69,.28)",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 18,
    minHeight: 110,
  },

  heroLeft: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    zIndex: 2,
  },

  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(255,255,255,.2), rgba(255,255,255,.07))",
    border:
      "1px solid rgba(255,255,255,.24)",
    boxShadow:
      "0 8px 24px rgba(0,0,0,.15)",
  },

  heroTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 850,
    letterSpacing: .2,
  },

  heroSubtitle: {
    margin: "5px 0 0",
    fontSize: 13,
    opacity: .78,
    maxWidth: 620,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,.09)",
    border:
      "1px solid rgba(255,255,255,.13)",
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: .6,
  },

  heroLineGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    background:
      "linear-gradient(90deg, transparent, #16A6B8, #8DE7F0, #16A6B8, transparent)",
    animation:
      "ts-glow 3s ease-in-out infinite",
  },

  newTaskButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background:
      "linear-gradient(135deg, #16A6B8, #08798C)",
    color: colors.white,
    border: "none",
    borderRadius: 13,
    padding: "12px 19px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 10px 25px rgba(22,166,184,.34)",
    zIndex: 2,
  },

  workspaceError: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#FFF1F0",
    border: "1px solid #FFCCC7",
    color: "#A83C55",
    borderRadius: 13,
    padding: "12px 16px",
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 650,
    flexWrap: "wrap",
  },

  retryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    background: colors.white,
    border: "1px solid #FFCCC7",
    color: "#A83C55",
    borderRadius: 9,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },

  statCard: {
    position: "relative",
    background: colors.white,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 18,
    padding: "17px 17px 15px",
    boxShadow:
      "0 8px 22px rgba(18,59,93,.055)",
  },

  statTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  statLabelWrap: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: 1.05,
    color: colors.muted,
  },

  statLabelDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background:
      "var(--stat-accent)",
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  statValueRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },

  statValue: {
    fontSize: 31,
    fontWeight: 850,
    color: colors.text,
    lineHeight: 1,
  },

  statMiniBadge: {
    fontSize: 9.5,
    fontWeight: 850,
    padding: "4px 8px",
    borderRadius: 999,
    letterSpacing: .4,
  },

  statProgress: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    marginBottom: 9,
    background: "#E4F3F7",
    overflow: "hidden",
    boxShadow: "inset 0 1px 2px rgba(8,42,69,.06)",
  },

  statProgressFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    transition:
      "width .7s cubic-bezier(.2,.8,.2,1)",
    boxShadow:
      "0 2px 8px rgba(22,166,184,.20)",
  },

  statDescription: {
    margin: 0,
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: 650,
  },

  pipeline: {
    background:
      "linear-gradient(135deg, #FFFFFF, #F6FCFD)",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 18,
    padding: "13px 16px",
    marginBottom: 16,
    boxShadow:
      "0 7px 20px rgba(18,59,93,.045)",
    overflow: "hidden",
  },

  pipelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 11,
  },

  pipelineTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 850,
    color: colors.text,
  },

  pipelineHint: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: 650,
  },

  pipelineTrack: {
    display: "flex",
    alignItems: "center",
    minWidth: 560,
  },

  pipelineStep: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  pipelineStepInner: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  pipelineDot: {
    width: 25,
    height: 25,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "3px solid #FFFFFF",
  },

  pipelineLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    color: colors.text,
    whiteSpace: "nowrap",
  },

  pipelineWave: {
    flex: 1,
    minWidth: 38,
    height: 32,
    margin: "0 5px",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    pointerEvents: "none",
  },

  filterCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: colors.white,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: "11px 13px",
    marginBottom: 17,
    flexWrap: "wrap",
    boxShadow:
      "0 6px 18px rgba(18,59,93,.05)",
  },

  searchWrapper: {
    flex: "1 1 280px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    background:
      "#EFF8FB",
    borderRadius: 10,
    padding: "9px 12px",
    color: colors.muted,
    border:
      "1px solid transparent",
  },

  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13,
    color: colors.text,
  },

  filterSelectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    color: colors.muted,
  },

  filterSelect: {
    appearance: "none",
    WebkitAppearance: "none",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.white,
    color: colors.text,
    fontSize: 12.5,
    fontWeight: 650,
    padding: "9px 31px 9px 11px",
    cursor: "pointer",
    outline: "none",
  },

  taskContainer: {
    background: colors.white,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 19,
    boxShadow:
      "0 9px 26px rgba(18,59,93,.06)",
  },

  taskHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  taskTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 850,
    color: colors.text,
  },

  taskDescription: {
    margin: "4px 0 0",
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: 650,
  },

  taskToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  refreshButton: {
    width: 35,
    height: 35,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border:
      `1px solid ${colors.border}`,
    background: colors.white,
    color: colors.blue,
    cursor: "pointer",
  },

  viewSwitcher: {
    display: "flex",
    background: colors.blueLight,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },

  viewButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: "none",
    background: "transparent",
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: 750,
    padding: "7px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },

  viewButtonActive: {
    background: colors.white,
    color: colors.blue,
    boxShadow:
      "0 2px 8px rgba(18,59,93,.10)",
  },

  smallCreateButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: colors.navy,
    color: colors.white,
    border: "none",
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 12.5,
    fontWeight: 750,
    cursor: "pointer",
  },

  tasksLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "55px 0",
    color: colors.muted,
    fontWeight: 700,
  },

  emptyState: {
    textAlign: "center",
    padding: "48px 16px",
  },

  emptyIcon: {
    width: 68,
    height: 68,
    margin: "0 auto 14px",
    borderRadius: 21,
    background:
      "linear-gradient(135deg, #E6F4FA, #E7F8FA)",
    color: colors.blue,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 12px 25px rgba(22,166,184,.10)",
  },

  emptyTitle: {
    margin: "0 0 6px",
    fontSize: 17,
    fontWeight: 850,
    color: colors.text,
  },

  emptyText: {
    margin: "0 0 18px",
    fontSize: 13,
    color: colors.muted,
  },

  emptyButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background:
      "linear-gradient(135deg, #16A6B8, #08798C)",
    color: colors.white,
    border: "none",
    borderRadius: 11,
    padding: "11px 18px",
    fontSize: 13,
    fontWeight: 750,
    cursor: "pointer",
  },

  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },

  columnBoard: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(245px, 1fr))",
    gap: 13,
  },

  boardColumn: {
    background:
      "linear-gradient(180deg, #F7FBFC, #F1F8FA)",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 15,
    padding: 11,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 230,
  },

  boardColumnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "3px 3px 7px",
  },

  boardColumnTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: colors.text,
  },

  boardStatusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },

  boardCount: {
    fontSize: 10.5,
    fontWeight: 850,
    background: colors.white,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: "3px 8px",
    color: colors.muted,
  },

  boardColumnBody: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  boardEmpty: {
    textAlign: "center",
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: 700,
    padding: "20px 0",
    border:
      `1px dashed ${colors.border}`,
    borderRadius: 10,
  },

  taskCard: {
    position: "relative",
    background: colors.white,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 15,
    boxShadow:
      "0 4px 14px rgba(18,59,93,.045)",
    overflow: "hidden",
  },

  taskCardMain: {
    position: "relative",
    display: "flex",
    gap: 13,
    padding: 14,
    alignItems: "flex-start",
  },

  taskCardMainBoard: {
    flexDirection: "column",
  },

  taskAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    transition:
      "width .25s ease",
  },

  taskCheckbox: {
    width: 35,
    height: 35,
    flexShrink: 0,
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  taskInfo: {
    flex: 1,
    minWidth: 0,
  },

  taskTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },

  taskCardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 850,
    color: colors.text,
    overflowWrap: "anywhere",
  },

  referenceBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    padding: "3px 7px",
    borderRadius: 999,
    color: colors.blue,
    background: colors.blueLight,
  },

  taskCardDesc: {
    margin: "0 0 9px",
    fontSize: 11.5,
    color: colors.muted,
    lineHeight: 1.45,
    maxWidth: 720,
  },

  boardMiniStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 9.5,
    fontWeight: 850,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid",
    marginBottom: 8,
  },

  taskMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 13px",
  },

  taskMetaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    fontWeight: 700,
    color: colors.muted,
  },

  taskRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  taskRightBoard: {
    justifyContent: "space-between",
    width: "100%",
  },

  statusSelectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  statusSelect: {
    appearance: "none",
    WebkitAppearance: "none",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 9,
    background: colors.white,
    color: colors.text,
    fontSize: 11,
    fontWeight: 750,
    padding: "7px 27px 7px 9px",
    cursor: "pointer",
    outline: "none",
  },

  statusSelectIcon: {
    position: "absolute",
    right: 7,
    pointerEvents: "none",
    color: colors.muted,
  },

  priorityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    fontWeight: 850,
    padding: "5px 9px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },

  progressWrap: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  progressTrack: {
    flex: 1,
    height: 4,
    background: "#EAF1F4",
    borderRadius: 99,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 99,
    transition:
      "width .6s cubic-bezier(.2,.8,.2,1)",
  },

  progressText: {
    fontSize: 9.5,
    fontWeight: 800,
    color: colors.muted,
    minWidth: 29,
    textAlign: "right",
  },

  taskActions: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },

  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 31,
    height: 31,
    borderRadius: 9,
    cursor: "pointer",
    border:
      `1px solid ${colors.border}`,
    background: colors.blueLight,
    color: colors.blue,
  },

  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 31,
    height: 31,
    borderRadius: 9,
    cursor: "pointer",
    border: "1px solid #F3D4D4",
    background: "#FDF0EF",
    color: "#C0453E",
  },

  /* MODAL */

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(5,28,46,.64)",
    backdropFilter: "blur(7px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999,
  },

  modal: {
    background: colors.white,
    borderRadius: 22,
    width: "min(780px, 100%)",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "0 35px 90px rgba(3,26,43,.42)",
    overflow: "hidden",
  },

  modalHeader: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 23px",
    borderBottom:
      `1px solid ${colors.border}`,
    background:
      "linear-gradient(135deg, #E9F7FB, #F4FCFD)",
    flexShrink: 0,
    overflow: "hidden",
  },

  modalHeaderGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    right: -80,
    top: -100,
    borderRadius: "50%",
    background:
      "rgba(22,166,184,.10)",
  },

  modalTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },

  modalTitleIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    background:
      "linear-gradient(135deg, #123B5D, #1677A8)",
    color: colors.white,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow:
      "0 8px 20px rgba(18,59,93,.2)",
  },

  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 850,
    color: colors.text,
  },

  modalSubtitle: {
    margin: "3px 0 0",
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: 600,
  },

  closeButton: {
    border: "none",
    background: "rgba(255,255,255,.7)",
    color: colors.muted,
    cursor: "pointer",
    padding: 7,
    borderRadius: 9,
    display: "flex",
    position: "relative",
    zIndex: 2,
  },

  modalBody: {
    padding: "20px 23px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 15,
  },

  formGridThree: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 13,
  },

  formGridTwo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 13,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  label: {
    fontSize: 11.5,
    fontWeight: 800,
    color: colors.text,
  },

  requiredStar: {
    color: "#C0453E",
  },

  selectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  select: {
    appearance: "none",
    WebkitAppearance: "none",
    width: "100%",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.white,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    padding: "11px 34px 11px 12px",
    cursor: "pointer",
    outline: "none",
    boxSizing: "border-box",
  },

  selectIcon: {
    position: "absolute",
    right: 11,
    pointerEvents: "none",
    color: colors.muted,
  },

  fieldHint: {
    margin: 0,
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: 600,
  },

  textarea: {
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.white,
    color: colors.text,
    fontSize: 13,
    padding: "11px 12px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
  },

  inputIconWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  inputWithIcon: {
    width: "100%",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.white,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    padding: "11px 36px 11px 12px",
    outline: "none",
    boxSizing: "border-box",
  },

  fieldIcon: {
    position: "absolute",
    right: 11,
    pointerEvents: "none",
    color: colors.muted,
  },

  input: {
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    background: colors.white,
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    padding: "11px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  priorityGroup: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
  },

  priorityButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: "1.5px solid",
    borderRadius: 9,
    padding: "8px 11px",
    fontSize: 11.5,
    cursor: "pointer",
  },

  complexityCard: {
    background:
      "linear-gradient(135deg, #EFF9FC, #E8F7FA)",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: 15,
  },

  complexityTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 850,
    color: colors.text,
  },

  sectionDescription: {
    margin: "2px 0 0",
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: 600,
  },

  scoreValue: {
    textAlign: "right",
    fontSize: 21,
    fontWeight: 850,
    color: colors.blue,
    lineHeight: 1,
  },

  rangeRow: {
    marginBottom: 5,
  },

  range: {
    width: "100%",
    accentColor: colors.ocean,
  },

  rangeLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 9.5,
    color: colors.muted,
    fontWeight: 700,
    marginBottom: 8,
  },

  optionalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: colors.muted,
    fontWeight: 700,
    background: colors.white,
    borderRadius: 8,
    padding: "7px 10px",
    border:
      `1px solid ${colors.border}`,
  },

  rewardCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background:
      "linear-gradient(120deg, #E8F9F7, #E7F5FB)",
    border:
      `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: "12px 15px",
    color: colors.text,
    fontSize: 12,
    fontWeight: 650,
    flexWrap: "wrap",
  },

  rewardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  rewardIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: colors.ocean,
    color: colors.white,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  expandCard: {
    border:
      `1px solid ${colors.border}`,
    borderRadius: 14,
    overflow: "hidden",
    background: colors.white,
    // Inside the scrolling flex column an overflow:hidden card may shrink to 0px —
    // that made Attachments / Recurring / Sub-tasks invisible.
    flexShrink: 0,
  },

  expandHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 15px",
    gap: 12,
  },

  expandTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: colors.text,
  },

  expandTitleText: {
    display: "flex",
    flexDirection: "column",
  },

  expandTitleMain: {
    fontSize: 12.5,
    fontWeight: 850,
  },

  expandTitleSub: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: 600,
  },

  toggle: {
    width: 44,
    height: 24,
    borderRadius: 999,
    border: "none",
    position: "relative",
    cursor: "pointer",
    flexShrink: 0,
  },

  toggleCircle: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: colors.white,
    transition:
      "transform .2s ease",
    boxShadow:
      "0 1px 4px rgba(0,0,0,.2)",
  },

  recurringBox: {
    padding: "0 15px 15px",
  },

  expandButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 15px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },

  expandRight: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: colors.muted,
  },

  countBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: colors.blueLight,
    color: colors.blue,
    borderRadius: 999,
    padding: "4px 9px",
    whiteSpace: "nowrap",
  },

  expandedContent: {
    padding: "0 15px 15px",
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },

  uploadBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1.5px dashed #8CCBD5",
    borderRadius: 15,
    padding: "23px 16px",
    cursor: "pointer",
    color: colors.muted,
    background: "linear-gradient(135deg, #F4FCFD 0%, #EAF8FA 100%)",
    fontSize: 11.5,
    textAlign: "center",
    transition: "border-color .2s ease, transform .2s ease, box-shadow .2s ease",
  },

  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "8px 11px",
    color: colors.text,
    fontSize: 11.5,
    fontWeight: 600,
  },

  fileName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  smallDelete: {
    border: "none",
    background: "#FDF0EF",
    color: "#C0453E",
    borderRadius: 8,
    width: 27,
    height: 27,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },

  subtaskInputRow: {
    display: "flex",
    gap: 8,
  },

  addSubtaskButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: colors.navy,
    color: colors.white,
    border: "none",
    borderRadius: 10,
    padding: "0 15px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  subtaskItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    border:
      `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "8px 11px",
  },

  subtaskNumber: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: colors.blueLight,
    color: colors.blue,
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  subtaskTitle: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: 700,
    color: colors.text,
  },

  modalError: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    margin: "0 23px 14px",
    background: "#FFF1F0",
    border: "1px solid #FFCCC7",
    color: "#A83C55",
    borderRadius: 10,
    padding: "10px 13px",
    fontSize: 11.5,
    fontWeight: 700,
    flexShrink: 0,
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 23px",
    borderTop:
      `1px solid ${colors.border}`,
    background: colors.background,
    flexShrink: 0,
  },

  cancelButton: {
    border:
      `1px solid ${colors.border}`,
    background: colors.white,
    color: colors.muted,
    borderRadius: 10,
    padding: "10px 19px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },

  createButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background:
      "linear-gradient(120deg, #16A6B8, #1677A8)",
    color: colors.white,
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontSize: 12.5,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 8px 18px rgba(22,119,168,.22)",
  },

  spinner: {
    animation:
      "ts-spin .9s linear infinite",
  },
};

/* =========================================================
   TASK FORM MODAL
========================================================= */

const TaskFormModal = ({
  onClose,
  onCreate,
  onUpdate,
  editingTask,
  departments,
  users,
}) => {
  const isEdit =
    Boolean(editingTask);

  const [
    taskName,
    setTaskName,
  ] = useState(
    editingTask?.name || ""
  );

  const [
    referenceId,
    setReferenceId,
  ] = useState(
    editingTask?.referenceId || ""
  );

  const [
    department,
    setDepartment,
  ] = useState(
    editingTask?.department || ""
  );

  const [
    assignedUser,
    setAssignedUser,
  ] = useState(
    // ⭐ user IDs (not names) — two people may share a name
    editingTask?.assignedTo ? String(editingTask.assignedTo) : ""
  );

  // Multi-assignee support; keep assignedUser for backward compatibility.
  const initialAssignees = editingTask?.assignedTo
    ? [String(editingTask.assignedTo)]
    : [];
  const [assignedUsers, setAssignedUsers] = useState(initialAssignees);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [
    description,
    setDescription,
  ] = useState(
    editingTask?.description || ""
  );

  const [
    dueDate,
    setDueDate,
  ] = useState(
    editingTask?.dueDate || ""
  );

  // Deadline time (reminders: 3h + 1h before, alert at the deadline)
  const [dueTime, setDueTime] = useState(
    editingTask?.dueTime || ""
  );

  const [
    priority,
    setPriority,
  ] = useState(
    editingTask?.priority || "Medium"
  );

  const [
    complexity,
    setComplexity,
  ] = useState(
    editingTask?.complexity ?? 0
  );

  const [
    reward,
    setReward,
  ] = useState(
    editingTask?.reward ?? 10
  );

  const [
    recurring,
    setRecurring,
  ] = useState(
    Boolean(editingTask?.recurring)
  );

  const [
    recurrenceInterval,
    setRecurrenceInterval,
  ] = useState(
    editingTask?.recurrenceInterval ||
      "Every day"
  );

  // Keep the file upload area open by default so users can easily
  // see and attach files while creating or editing a task.
  const [
    showAttachments,
    setShowAttachments,
  ] = useState(true);

  const [
    showSubtasks,
    setShowSubtasks,
  ] = useState(false);

  const [
    attachments,
    setAttachments,
  ] = useState(
    (editingTask?.attachments || []).map(
      normalizeAttachmentForForm
    )
  );

  const [
    subtasks,
    setSubtasks,
  ] = useState(
    (editingTask?.subtasks || []).map(
      normalizeSubtaskForForm
    )
  );

  const [
    subtaskInput,
    setSubtaskInput,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, []);

  const availableUsers = useMemo(() => {
    if (!department) {
      return users;
    }

    const filtered =
      users.filter((user) => {
        const userDepartment =
          typeof user.department ===
          "object"
            ? user.department?.name ||
              user.department
                ?.departmentName ||
              ""
            : user.department || "";

        return (
          String(userDepartment)
            .trim()
            .toLowerCase() ===
          String(department)
            .trim()
            .toLowerCase()
        );
      });

    // Keep the current assignee selectable even if outside the filtered list
    if (
      assignedUser &&
      !filtered.some(
        (u) =>
          String(u.id) === String(assignedUser)
      )
    ) {
      const known = users.find((u) => String(u.id) === String(assignedUser));
      return [
        known || {
          id: assignedUser,
          name: editingTask?.assignedUser || "Current assignee",
          department,
        },
        ...filtered,
      ];
    }

    return filtered;
  }, [
    department,
    users,
    assignedUser,
    editingTask,
  ]);

  const userNameById = (id) =>
    users.find((u) => String(u.id) === String(id))?.name ||
    (String(id) === String(editingTask?.assignedTo) ? editingTask?.assignedUser : "") ||
    "Unknown user";

  const handleDepartmentChange = (
    event
  ) => {
    setDepartment(
      event.target.value
    );
    setAssignedUser("");
    setAssignedUsers([]);
  };

  const [dragActive, setDragActive] = useState(false);

  // Validate + add files (from the picker or drag-and-drop)
  const addFiles = (fileList) => {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;

    const problems = [];
    const accepted = [];
    const existingKeys = new Set(
      attachments.map((file) => `${file.name}:${file.size}`)
    );

    selectedFiles.forEach((file) => {
      const key = `${file.name}:${file.size}`;
      if (!ATTACHMENT_EXTENSIONS.includes(fileExtension(file.name))) {
        problems.push(`${file.name} is not a supported file type`);
      } else if (file.size > MAX_ATTACHMENT_SIZE) {
        problems.push(`${file.name} is larger than 10 MB`);
      } else if (file.size === 0) {
        problems.push(`${file.name} is empty`);
      } else if (!existingKeys.has(key)) {
        existingKeys.add(key);
        accepted.push(file);
      }
    });

    const room = MAX_ATTACHMENTS - uploadedFiles.length;
    if (accepted.length > room) {
      problems.push(`You can upload at most ${MAX_ATTACHMENTS} new files at once`);
      accepted.splice(Math.max(room, 0));
    }

    setUploadedFiles((previous) => [...previous, ...accepted]);
    setAttachments((previous) => [
      ...previous,
      ...accepted.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        existing: false,
      })),
    ]);

    setError(problems.length ? `${problems.join(". ")}.` : "");
  };

  const handleFileChange = (event) => {
    addFiles(event.target.files);
    // Reset the input so the same file can be selected again after removal.
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (!submitting) addFiles(event.dataTransfer.files);
  };

  const addSubtask = () => {
    const value =
      subtaskInput.trim();

    if (!value) return;

    setSubtasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: value,
      },
    ]);

    setSubtaskInput("");
  };

  const removeSubtask = (id) => {
    setSubtasks((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  };

  const removeAttachment = (target) => {
    setAttachments((prev) => prev.filter((item) => item !== target));
    if (!target.existing) {
      setUploadedFiles((prev) =>
        prev.filter(
          (file) => !(file.name === target.name && file.size === target.size)
        )
      );
    }
  };

  const buildPayload = () => ({
    name: taskName.trim(),

    referenceId:
      referenceId.trim(),

    department,

    assignedUser: assignedUsers[0] || assignedUser || "",
    assignedUsers,

    description:
      description.trim(),

    dueDate,

    dueTime,

    priority,

    complexity,

    reward,

    recurring,

    recurrenceInterval:
      recurring
        ? recurrenceInterval
        : "Every day",

    // Edit: the EXISTING attachments to keep (new files travel as multipart "files")
    ...(isEdit
      ? {
          attachments: attachments
            .filter((file) => file.existing)
            .map((file) => ({ filename: file.filename, name: file.name })),
        }
      : {}),

    subtasks:
      subtasks.map(
        ({ title }) => ({
          title,
        })
      ),

    ...(isEdit
      ? {
          status:
            normalizeStatus(
              editingTask.status
            ),
        }
      : {
          status: "To Do",
        }),
  });

  const handleSubmit = async () => {
    if (submitting) return;

    if (!taskName.trim()) {
      setError(
        "Please enter task name."
      );
      return;
    }

    if (!department) {
      setError(
        "Please select a department."
      );
      return;
    }

    if (!dueDate) {
      setError(
        "Please select due date."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload = buildPayload();
      let requestPayload = payload;

      // Use multipart/form-data when new files are attached so file bytes
      // are sent to the API (the backend route must use multipart middleware).
      if (uploadedFiles.length) {
        requestPayload = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          requestPayload.append(
            key,
            value !== null && typeof value === "object"
              ? JSON.stringify(value)
              : String(value ?? "")
          );
        });
        uploadedFiles.forEach((file) => requestPayload.append("files", file));
      }

      if (isEdit) {
        const updated =
          await updateTaskApi(
            editingTask.id,
            requestPayload
          );

        const doc =
          updated &&
          (updated._id ||
            updated.id)
            ? updated
            : {
                ...editingTask,
                ...payload,
              };

        onUpdate(
          normalizeTask(doc)
        );
      } else {
        const created =
          await createTaskApi(
            requestPayload
          );

        const doc =
          created &&
          (created._id ||
            created.id)
            ? created
            : {
                ...payload,
              };

        onCreate(
          normalizeTask(doc)
        );
      }
    } catch (err) {
      const status =
        err?.response?.status;

      if (status === 401) {
        setError(
          "Session expired. Please log in again."
        );
      } else if (status === 403) {
        setError(
          "You don't have permission to save tasks (403)."
        );
      } else {
        setError(
          err?.response?.data
            ?.message ||
            `Failed to ${
              isEdit
                ? "update"
                : "create"
            } task. Please try again.`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="ts-modal-overlay"
      style={styles.modalOverlay}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          if (!submitting) {
            onClose();
          }
        }
      }}
    >
      <div
        className="ts-modal"
        style={styles.modal}
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        {/* HEADER */}

        <div
          style={
            styles.modalHeader
          }
        >
          <div
            style={
              styles.modalHeaderGlow
            }
          />

          <div
            style={
              styles.modalTitleRow
            }
          >
            <div
              style={
                styles.modalTitleIcon
              }
            >
              {isEdit ? (
                <Pencil size={19} />
              ) : (
                <Plus size={19} />
              )}
            </div>

            <div>
              <h2
                style={
                  styles.modalTitle
                }
              >
                {isEdit
                  ? "Edit Task"
                  : "Create New Task"}
              </h2>

              <p
                style={
                  styles.modalSubtitle
                }
              >
                {isEdit
                  ? "Refine your task and keep your workflow moving"
                  : "Build a clear task and assign it to your workspace"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={
              styles.closeButton
            }
            disabled={submitting}
          >
            <X size={19} />
          </button>
        </div>

        {/* BODY */}

        <div
          className="ts-modal-content"
          style={styles.modalBody}
        >
          <div
            style={
              styles.formGridThree
            }
          >
            <div style={styles.field}>
              <label
                style={styles.label}
              >
                Task Name{" "}
                <span
                  style={
                    styles.requiredStar
                  }
                >
                  *
                </span>
              </label>

              <input
                value={taskName}
                onChange={(e) =>
                  setTaskName(
                    e.target.value
                  )
                }
                placeholder="Enter task name"
                style={styles.input}
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label
                style={styles.label}
              >
                Reference ID
              </label>

              <input
                value={referenceId}
                onChange={(e) =>
                  setReferenceId(
                    e.target.value
                  )
                }
                placeholder="Optional reference ID"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label
                style={styles.label}
              >
                Department{" "}
                <span
                  style={
                    styles.requiredStar
                  }
                >
                  *
                </span>
              </label>

              <div
                style={
                  styles.selectWrapper
                }
              >
                <select
                  value={department}
                  onChange={
                    handleDepartmentChange
                  }
                  style={styles.select}
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (item) => (
                      <option
                        key={
                          item.id ||
                          item.name
                        }
                        value={
                          item.name
                        }
                      >
                        {item.name}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={15}
                  style={
                    styles.selectIcon
                  }
                />
              </div>
            </div>
          </div>

          {/* ASSIGNED USERS / REASSIGNMENT */}

          <div style={styles.field}>
            <label style={styles.label}>
              {isEdit ? "Reassign Task — Select Users" : "Assign Task — Select Users"}
            </label>
            <div style={{ ...styles.selectWrapper, display: "block" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", marginBottom: 8, border: `1px solid ${colors.border || "#d1d5db"}`, borderRadius: 8, cursor: availableUsers.length ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700 }}
              >
                <input
                  type="checkbox"
                  checked={availableUsers.length > 0 && availableUsers.every((user) => assignedUsers.includes(String(user.id)))}
                  disabled={availableUsers.length === 0}
                  onChange={(e) => {
                    const selected = e.target.checked
                      ? Array.from(new Set([...assignedUsers, ...availableUsers.map((user) => String(user.id))]))
                      : assignedUsers.filter((id) => !availableUsers.some((user) => String(user.id) === id));
                    setAssignedUsers(selected);
                    setAssignedUser(selected[0] || "");
                  }}
                />
                Select All Users ({availableUsers.length})
              </label>
              <select
                multiple
                value={assignedUsers}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setAssignedUsers(selected);
                  setAssignedUser(selected[0] || "");
                }}
                style={{ ...styles.select, width: "100%", minHeight: 112, padding: 10 }}
                aria-label="Select multiple task assignees"
              >
                {availableUsers.map((user) => (
                  <option key={user.id} value={String(user.id)} style={{ padding: "7px 5px" }}>
                    {user.name}{user.department ? ` — ${user.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <p style={styles.fieldHint}>
              Use “Select All Users” to assign everyone, or select individual users below.
              {isEdit ? " Change the selection to reassign the task." : ""}
            </p>
            {assignedUsers.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {assignedUsers.map((id) => (
                  <span key={id} style={{ background: colors.blueLight, color: colors.blue, borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 700 }}>
                    {userNameById(id)}
                    <button type="button" onClick={() => {
                      const next = assignedUsers.filter((item) => item !== id);
                      setAssignedUsers(next);
                      setAssignedUser(next[0] || "");
                    }} aria-label={`Remove ${userNameById(id)}`} style={{ marginLeft: 7, border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* DESCRIPTION */}

          <div style={styles.field}>
            <label
              style={styles.label}
            >
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Describe what needs to be completed..."
              style={
                styles.textarea
              }
              rows={4}
            />
          </div>

          {/* DATE + PRIORITY */}

          <div
            style={
              styles.formGridTwo
            }
          >
            <div style={styles.field}>
              <label
                style={styles.label}
              >
                Due Date{" "}
                <span
                  style={
                    styles.requiredStar
                  }
                >
                  *
                </span>
              </label>

              <div
                style={
                  styles.inputIconWrapper
                }
              >
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) =>
                    setDueDate(
                      e.target.value
                    )
                  }
                  style={
                    styles.inputWithIcon
                  }
                />

                <CalendarDays
                  size={16}
                  style={
                    styles.fieldIcon
                  }
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Clock3 size={14} color={colors.muted} />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  aria-label="Due time"
                  style={{ ...styles.inputWithIcon, paddingLeft: 12, flex: 1 }}
                />
                {dueTime && (
                  <button
                    type="button"
                    onClick={() => setDueTime("")}
                    title="Clear time"
                    style={{ border: "none", background: "transparent", color: colors.muted, cursor: "pointer" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: 10, color: colors.muted, marginTop: 4, display: "block" }}>
                Reminders go out 3 h and 1 h before this time if the task isn't started
                {dueTime ? "" : " (no time = end of day)"}.
              </span>
            </div>

            <div style={styles.field}>
              <label
                style={styles.label}
              >
                Priority
              </label>

              <div
                style={
                  styles.priorityGroup
                }
              >
                {Object.keys(
                  priorityConfig
                ).map((item) => {
                  const config =
                    priorityConfig[
                      item
                    ];

                  const Icon =
                    config.icon;

                  const active =
                    priority === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setPriority(
                          item
                        )
                      }
                      style={{
                        ...styles.priorityButton,
                        background:
                          active
                            ? config.background
                            : colors.white,
                        color: active
                          ? config.color
                          : colors.muted,
                        borderColor:
                          active
                            ? config.color
                            : colors.border,
                        fontWeight:
                          active
                            ? 750
                            : 500,
                      }}
                    >
                      <Icon
                        size={13}
                      />

                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COMPLEXITY */}

          <div
            style={
              styles.complexityCard
            }
          >
            <div
              style={
                styles.complexityTop
              }
            >
              <div>
                <h3
                  style={
                    styles.sectionTitle
                  }
                >
                  Complexity Score
                </h3>

                <p
                  style={
                    styles.sectionDescription
                  }
                >
                  Estimated task difficulty
                </p>
              </div>

              <div
                style={
                  styles.scoreValue
                }
              >
                {complexity}
                <span
                  style={{
                    fontSize: 11,
                    color: colors.muted,
                  }}
                >
                  /100
                </span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={complexity}
              onChange={(e) =>
                setComplexity(
                  Number(
                    e.target.value
                  )
                )
              }
              style={styles.range}
            />

            <div
              style={
                styles.rangeLabels
              }
            >
              <span>
                0 · Very Low
              </span>
              <span>
                100 · Very High
              </span>
            </div>

            <div
              style={
                styles.optionalRow
              }
            >
              <span>
                Difficulty level
              </span>

              <span>
                {complexity <= 25
                  ? "Easy"
                  : complexity <=
                    55
                  ? "Moderate"
                  : complexity <=
                    80
                  ? "Advanced"
                  : "Expert"}
              </span>
            </div>
          </div>

          {/* REWARD */}

          <div
            style={
              styles.rewardCard
            }
          >
            <div
              style={
                styles.rewardLeft
              }
            >
              <div
                style={
                  styles.rewardIcon
                }
              >
                <Award size={16} />
              </div>

              <span>
                Completion reward
              </span>
            </div>

            <strong>
              +{reward} points on completion
            </strong>
          </div>

          {/* ATTACHMENTS — below the Task Score section */}

          <div
            style={
              styles.expandCard
            }
          >
            <button
              type="button"
              onClick={() =>
                setShowAttachments(
                  !showAttachments
                )
              }
              style={
                styles.expandButton
              }
            >
              <div
                style={
                  styles.expandTitle
                }
              >
                <Paperclip size={17} />

                <div
                  style={
                    styles.expandTitleText
                  }
                >
                  <strong
                    style={
                      styles.expandTitleMain
                    }
                  >
                    Attachments
                  </strong>

                  <span
                    style={
                      styles.expandTitleSub
                    }
                  >
                    Files are uploaded when you save the task
                  </span>
                </div>
              </div>

              <div
                style={
                  styles.expandRight
                }
              >
                <span
                  style={
                    styles.countBadge
                  }
                >
                  {attachments.length} files
                </span>

                {showAttachments ? (
                  <ChevronUp size={17} />
                ) : (
                  <ChevronDown size={17} />
                )}
              </div>
            </button>

            {showAttachments && (
              <div
                style={
                  styles.expandedContent
                }
              >
                <label
                  style={{
                    ...styles.uploadBox,
                    ...(dragActive
                      ? {
                          borderColor: colors.ocean,
                          background: "#E8F7F8",
                          transform: "scale(1.01)",
                        }
                      : {}),
                    transition: "all .18s ease",
                    opacity: submitting ? 0.6 : 1,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <UploadCloud size={24} />

                  <strong>
                    {dragActive
                      ? "Drop files to attach"
                      : "Click to upload or drag & drop"}
                  </strong>

                  <span style={{ fontSize: 10, color: "#7893A3" }}>
                    PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP, images · max 10 MB each · up to {MAX_ATTACHMENTS} files
                  </span>

                  <input
                    type="file"
                    multiple
                    disabled={submitting}
                    accept={ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                    onChange={handleFileChange}
                    hidden
                  />
                </label>

                {attachments.length >
                  0 && (
                  <div
                    style={
                      styles.fileList
                    }
                  >
                    {attachments.map(
                      (file, index) => (
                        <div
                          key={`${file.filename || file.name}-${index}`}
                          style={
                            styles.fileItem
                          }
                        >
                          <FileText
                            size={15}
                          />

                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={styles.fileName}>
                              {file.name}
                            </span>
                            <span style={{ fontSize: 10, color: colors.muted, fontWeight: 500 }}>
                              {[
                                formatFileSize(file.size),
                                fileExtension(file.name).toUpperCase(),
                                file.existing ? "Saved" : "New — uploads on save",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>

                          {file.existing && file.downloadable && (
                            <button
                              type="button"
                              title="Download"
                              onClick={() =>
                                downloadAttachment(file).catch(() =>
                                  setError(`Could not download ${file.name}.`)
                                )
                              }
                              style={{
                                ...styles.smallDelete,
                                color: colors.ocean,
                              }}
                            >
                              <Download size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Remove"
                            disabled={submitting}
                            onClick={() =>
                              removeAttachment(
                                file
                              )
                            }
                            style={
                              styles.smallDelete
                            }
                          >
                            <Trash2
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RECURRING */}

          <div
            style={
              styles.expandCard
            }
          >
            <div
              style={
                styles.expandHeader
              }
            >
              <div
                style={
                  styles.expandTitle
                }
              >
                <RotateCcw
                  size={17}
                />

                <div
                  style={
                    styles.expandTitleText
                  }
                >
                  <strong
                    style={
                      styles.expandTitleMain
                    }
                  >
                    Make this task recurring
                  </strong>

                  <span
                    style={
                      styles.expandTitleSub
                    }
                  >
                    Automatically repeat this task
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setRecurring(
                    !recurring
                  )
                }
                style={{
                  ...styles.toggle,
                  background:
                    recurring
                      ? colors.ocean
                      : "#CFDEE8",
                }}
              >
                <span
                  style={{
                    ...styles.toggleCircle,
                    transform:
                      recurring
                        ? "translateX(20px)"
                        : "translateX(0)",
                  }}
                />
              </button>
            </div>

            {recurring && (
              <div
                style={
                  styles.recurringBox
                }
              >
                <select
                  value={
                    recurrenceInterval
                  }
                  onChange={(e) =>
                    setRecurrenceInterval(
                      e.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option>
                    Every day
                  </option>

                  <option>
                    Every week
                  </option>

                  <option>
                    Every month
                  </option>
                </select>
              </div>
            )}
          </div>

          {/* SUBTASKS */}

          <div
            style={
              styles.expandCard
            }
          >
            <button
              type="button"
              onClick={() =>
                setShowSubtasks(
                  !showSubtasks
                )
              }
              style={
                styles.expandButton
              }
            >
              <div
                style={
                  styles.expandTitle
                }
              >
                <ListChecks
                  size={17}
                />

                <div
                  style={
                    styles.expandTitleText
                  }
                >
                  <strong
                    style={
                      styles.expandTitleMain
                    }
                  >
                    Sub-tasks
                  </strong>

                  <span
                    style={
                      styles.expandTitleSub
                    }
                  >
                    Break this task into smaller steps
                  </span>
                </div>
              </div>

              <div
                style={
                  styles.expandRight
                }
              >
                <span
                  style={
                    styles.countBadge
                  }
                >
                  {subtasks.length} sub-tasks
                </span>

                {showSubtasks ? (
                  <ChevronUp size={17} />
                ) : (
                  <ChevronDown
                    size={17}
                  />
                )}
              </div>
            </button>

            {showSubtasks && (
              <div
                style={
                  styles.expandedContent
                }
              >
                <div
                  style={
                    styles.subtaskInputRow
                  }
                >
                  <input
                    value={subtaskInput}
                    onChange={(e) =>
                      setSubtaskInput(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                        "Enter"
                      ) {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                    placeholder="Enter sub-task"
                    style={{
                      ...styles.input,
                      flex: 1,
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      addSubtask
                    }
                    style={
                      styles.addSubtaskButton
                    }
                  >
                    <Plus size={15} />
                    Add
                  </button>
                </div>

                {subtasks.length >
                  0 && (
                  <div
                    style={
                      styles.subtaskList
                    }
                  >
                    {subtasks.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.id
                          }
                          style={
                            styles.subtaskItem
                          }
                        >
                          <span
                            style={
                              styles.subtaskNumber
                            }
                          >
                            {index + 1}
                          </span>

                          <span
                            style={
                              styles.subtaskTitle
                            }
                          >
                            {
                              item.title
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeSubtask(
                                item.id
                              )
                            }
                            style={
                              styles.smallDelete
                            }
                          >
                            <Trash2
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={
              styles.modalError
            }
          >
            <AlertTriangle
              size={15}
            />

            <span>{error}</span>
          </div>
        )}

        {/* FOOTER */}

        <div
          style={
            styles.modalFooter
          }
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={
              styles.cancelButton
            }
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...styles.createButton,
              opacity:
                submitting
                  ? 0.65
                  : 1,
              cursor:
                submitting
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {submitting ? (
              <>
                <Loader2
                  size={16}
                  style={
                    styles.spinner
                  }
                />

                {uploadedFiles.length
                  ? `Uploading ${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"}...`
                  : "Saving..."}
              </>
            ) : (
              <>
                {isEdit ? (
                  <Pencil size={16} />
                ) : (
                  <Plus size={16} />
                )}

                {isEdit
                  ? "Save Changes"
                  : "Assign Task"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   TASKS PAGE
========================================================= */

const TasksPage = () => {
  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    tasksLoading,
    setTasksLoading,
  ] = useState(true);

  const [
    tasksError,
    setTasksError,
  ] = useState("");

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    loadingWorkspaceData,
    setLoadingWorkspaceData,
  ] = useState(true);

  const [
    workspaceDataError,
    setWorkspaceDataError,
  ] = useState("");

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    editingTask,
    setEditingTask,
  ] = useState(null);

  const [
    actionError,
    setActionError,
  ] = useState("");

  const [actionMessage, setActionMessage] = useState("");
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sessionUser] = useState(getSessionUser);
  const canCreateTasks = canDo(sessionUser, "tasks", "create");
  const canEditTasks = canDo(sessionUser, "tasks", "edit");
  const canDeleteTasks = canDo(sessionUser, "tasks", "delete");
  const canImportTasks = canDo(sessionUser, "tasks", "import") || canDo(sessionUser, "calendar", "import");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (!actionMessage) return undefined;
    const timer = setTimeout(() => setActionMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState(
    "All Status"
  );

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState(
    "All Priority"
  );

  const [
    viewMode,
    setViewMode,
  ] = useState("rows");

  const [
    updatingTaskIds,
    setUpdatingTaskIds,
  ] = useState({});

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const visibleFields = {
    department: true,
    assignedUser: true,
    dueDate: true,
    priority: true,
    status: true,
  };

  /* =====================================================
     LOAD WORKSPACE DATA
  ===================================================== */

  const loadWorkspaceData =
    useCallback(async () => {
      setLoadingWorkspaceData(
        true
      );

      setWorkspaceDataError("");

      const token =
        getAuthToken();

      if (!token) {
        setWorkspaceDataError(
          "You are not logged in. Please sign in again."
        );

        setLoadingWorkspaceData(
          false
        );

        setTimeout(() => {
          window.location.href =
            "/login";
        }, 1500);

        return;
      }

      try {
        const [
          usersResponse,
          departmentsResponse,
        ] = await Promise.all([
          api.get(
            "/users/assignable"
          ),
          api.get(
            "/departments"
          ),
        ]);

        setUsers(
          extractApiData(
            usersResponse
          )
            .map(normalizeUser)
            .filter(
              (u) => u.name
            )
        );

        setDepartments(
          extractApiData(
            departmentsResponse
          )
            .map(
              normalizeDepartment
            )
            .filter(
              (d) => d.name
            )
        );

        setWorkspaceDataError(
          ""
        );
      } catch (error) {
        console.error(
          "Failed to load workspace data:",
          error
        );

        const status =
          error?.response
            ?.status;

        if (status === 401) {
          setWorkspaceDataError(
            "Session expired. Redirecting to login..."
          );

          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "user"
          );

          setTimeout(() => {
            window.location.href =
              "/login";
          }, 1500);
        } else if (
          status === 403
        ) {
          setWorkspaceDataError(
            "Permission denied (403): cannot load users/departments."
          );

          setUsers([]);
          setDepartments([]);
        } else if (
          error?.code ===
          "ERR_NETWORK"
        ) {
          setWorkspaceDataError(
            `Cannot reach the server at ${API_URL}. Is the backend running?`
          );

          setUsers([]);
          setDepartments([]);
        } else {
          setWorkspaceDataError(
            error?.response
              ?.data?.message ||
              "Unable to load users and departments."
          );

          setUsers([]);
          setDepartments([]);
        }
      } finally {
        setLoadingWorkspaceData(
          false
        );
      }
    }, []);

  /* =====================================================
     LOAD TASKS
     
     IMPORTANT:
     silent=true is used after status update.
     This fixes the refresh/persistence UI problem without
     showing the whole loading screen.
  ===================================================== */

  const loadTasks =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setTasksLoading(true);
        }

        setTasksError("");

        try {
          const raw =
            await fetchTasksApi();

          const normalized =
            raw.map(
              normalizeTask
            );

          setTasks(
            normalized
          );

          return normalized;
        } catch (err) {
          console.error(
            "Failed to load tasks:",
            err
          );

          const status =
            err?.response
              ?.status;

          if (status === 401) {
            setTasksError(
              "Session expired. Redirecting to login..."
            );

            localStorage.removeItem(
              "token"
            );

            localStorage.removeItem(
              "user"
            );

            setTimeout(() => {
              window.location.href =
                "/login";
            }, 1500);
          } else if (
            err?.code ===
            "ERR_NETWORK"
          ) {
            setTasksError(
              `Cannot reach the server at ${API_URL}. Is the backend running?`
            );
          } else {
            setTasksError(
              err?.response
                ?.data?.message ||
                "Unable to load tasks."
            );
          }

          throw err;
        } finally {
          if (!silent) {
            setTasksLoading(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Real time: a task was assigned / reassigned / changed → refresh the list quietly
  useEffect(() => {
    const onRealtime = (event) => {
      if (String(event.detail?.type || "").startsWith("task_")) {
        loadTasks({ silent: true }).catch(() => {});
      }
    };
    window.addEventListener("realtime:notification", onRealtime);
    return () => window.removeEventListener("realtime:notification", onRealtime);
  }, [loadTasks]);

  /* =====================================================
     FILTERS
  ===================================================== */

  const filteredTasks =
    useMemo(() => {
      return tasks.filter(
        (task) => {
          const q =
            search
              .trim()
              .toLowerCase();

          const matchesSearch =
            !q ||
            task.name
              .toLowerCase()
              .includes(q) ||
            task.assignedUser
              ?.toLowerCase()
              .includes(q) ||
            task.department
              ?.toLowerCase()
              .includes(q);

          const matchesStatus =
            statusFilter ===
              "All Status" ||
            normalizeStatus(
              task.status
            ) ===
              normalizeStatus(
                statusFilter
              );

          const matchesPriority =
            priorityFilter ===
              "All Priority" ||
            task.priority ===
              priorityFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority
          );
        }
      );
    }, [
      tasks,
      search,
      statusFilter,
      priorityFilter,
    ]);

  /* =====================================================
     STATS
  ===================================================== */

  const stats = useMemo(
    () => ({
      total: tasks.length,

      todo: tasks.filter(
        (t) =>
          normalizeStatus(
            t.status
          ) === "To Do"
      ).length,

      progress: tasks.filter(
        (t) =>
          normalizeStatus(
            t.status
          ) === "In Progress"
      ).length,

      review: tasks.filter(
        (t) =>
          normalizeStatus(
            t.status
          ) === "Review"
      ).length,

      completed: tasks.filter(
        (t) =>
          normalizeStatus(
            t.status
          ) === "Completed"
      ).length,
    }),
    [tasks]
  );

  /* =====================================================
     CREATE
  ===================================================== */

  const handleCreateTask =
    async (newTask) => {
      setTasks((prev) => [
        newTask,
        ...prev,
      ]);

      setShowModal(false);
      setEditingTask(null);
      setActionMessage(`Task "${newTask.name}" created.`);

      // Make sure UI matches database.
      try {
        await loadTasks({
          silent: true,
        });
      } catch {
        // Existing task is already shown.
      }
    };

  /* =====================================================
     UPDATE
  ===================================================== */

  const handleUpdateTask =
    async (updatedTask) => {
      setTasks((prev) =>
        prev.map((task) =>
          String(task.id) ===
          String(
            updatedTask.id
          )
            ? updatedTask
            : task
        )
      );

      setShowModal(false);
      setEditingTask(null);
      setActionMessage(`Task "${updatedTask.name}" updated.`);

      try {
        await loadTasks({
          silent: true,
        });
      } catch {
        // Keep optimistic update.
      }
    };

  const openCreateModal =
    () => {
      setEditingTask(null);
      setShowModal(true);
    };

  const openEditModal =
    (task) => {
      setEditingTask(task);
      setShowModal(true);
    };

  /* =====================================================
     REFRESH
  ===================================================== */

  const handleRefresh =
    async () => {
      if (refreshing) return;

      setRefreshing(true);

      try {
        await Promise.all([
          loadTasks({
            silent: true,
          }),
          loadWorkspaceData(),
        ]);
      } finally {
        setRefreshing(false);
      }
    };

  /* =====================================================
     STATUS CHANGE
     
     IMPORTANT:
     1. Optimistic UI
     2. Save to backend
     3. Re-fetch backend data silently
     
     Therefore refresh will show the saved status.
  ===================================================== */

  const handleStatusChange =
    async (
      taskId,
      newStatus
    ) => {
      const normalizedStatus =
        normalizeStatus(
          newStatus
        );

      const previousTasks =
        tasks;

      const task =
        tasks.find(
          (t) =>
            String(t.id) ===
            String(taskId)
        );

      if (!task) return;

      if (
        normalizeStatus(
          task.status
        ) ===
        normalizedStatus
      ) {
        return;
      }

      setActionError("");

      setUpdatingTaskIds(
        (prev) => ({
          ...prev,
          [taskId]: true,
        })
      );

      // Optimistic UI
      setTasks((prev) =>
        prev.map((t) =>
          String(t.id) ===
          String(taskId)
            ? {
                ...t,
                status:
                  normalizedStatus,
              }
            : t
        )
      );

      try {
        await updateTaskStatusApi(
          taskId,
          normalizedStatus,
          task.rawStatus
        );

        /*
          IMPORTANT FIX:

          After successful POST/PATCH/PUT,
          fetch again from MongoDB.

          This means:
          UI status
             ↓
          Backend/MongoDB
             ↓
          GET /tasks
             ↓
          UI

          So after browser refresh the
          real status remains visible.
        */

        await loadTasks({
          silent: true,
        });
      } catch (err) {
        setTasks(
          previousTasks
        );

        setActionError(
          err?.message ||
            "Failed to save task status."
        );

        console.error(
          "[Status] failed:",
          err
        );
      } finally {
        setUpdatingTaskIds(
          (prev) => {
            const next = {
              ...prev,
            };

            delete next[taskId];

            return next;
          }
        );
      }
    };

  /* =====================================================
     DELETE
  ===================================================== */

  // Opens the confirmation dialog
  const handleDeleteTask =
    (taskId) => {
      const task = tasks.find(
        (t) => String(t.id) === String(taskId)
      );
      if (task) {
        setActionError("");
        setTaskToDelete(task);
      }
    };

  const confirmDeleteTask =
    async () => {
      if (!taskToDelete || deleting) return;

      setDeleting(true);
      setActionError("");

      try {
        await deleteTaskApi(
          taskToDelete.id
        );

        setTasks((prev) =>
          prev.filter(
            (task) =>
              String(task.id) !==
              String(taskToDelete.id)
          )
        );
        setActionMessage(`Task "${taskToDelete.name}" deleted.`);
        setTaskToDelete(null);

        // Stats are derived from the list — re-sync with the database
        try {
          await loadTasks({ silent: true });
        } catch {
          // List already updated locally.
        }
      } catch (err) {
        setActionError(
          err?.response
            ?.data?.message ||
            `Failed to delete task (${
              err?.response?.status ||
              "network error"
            }).`
        );
        setTaskToDelete(null);
      } finally {
        setDeleting(false);
      }
    };

  const editHandlerFor = (task) =>
    canEditTasks && canModifyTask(sessionUser, task)
      ? openEditModal
      : undefined;

  const deleteHandlerFor = (task) =>
    canDeleteTasks && canModifyTask(sessionUser, task)
      ? handleDeleteTask
      : undefined;

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <style>
        {globalCss}
      </style>

      <div
        className="task-page-unique ts-page"
        style={styles.page}
      >
        {/* =================================================
            HERO
        ================================================= */}

        <div
          className="ts-shimmer ts-hero"
          style={styles.hero}
        >
          <div className="ts-hero-grid" />

          <span
            className="ts-floating-dot"
            style={{
              width: 120,
              height: 120,
              right: "6%",
              top: -58,
            }}
          />

          <span
            className="ts-floating-dot"
            style={{
              width: 52,
              height: 52,
              right: "22%",
              bottom: -25,
              animationDelay:
                "1.1s",
            }}
          />

          <span
            className="ts-floating-dot"
            style={{
              width: 30,
              height: 30,
              right: "38%",
              top: 18,
              animationDelay:
                "2.1s",
            }}
          />

          <div className="ts-wave-line" />

          <span
            style={
              styles.heroLineGlow
            }
          />

          <div
            style={
              styles.heroLeft
            }
          >
            <div
              style={
                styles.heroIcon
              }
            >
              <Waves size={24} />
            </div>

            <div>
              <h1
                className="ts-hero-title"
                style={
                  styles.heroTitle
                }
              >
                Task Workspace
              </h1>

              <p
                style={
                  styles.heroSubtitle
                }
              >
                Create, assign, track and complete your team's work from one intelligent workspace.
                {loadingWorkspaceData
                  ? " · Syncing..."
                  : ""}
              </p>

              <div
                style={
                  styles.heroBadge
                }
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius:
                      "50%",
                    background:
                      "#6CE2D1",
                  }}
                />

                LIVE WORKSPACE

                <span>
                  ·
                </span>

                <Sparkles
                  size={11}
                />

                Ocean Flow
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
          {canImportTasks && (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="ts-action-button"
            style={{
              ...styles.newTaskButton,
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.35)",
              boxShadow: "none",
            }}
          >
            <Upload size={17} />
            Import
          </button>
          )}
          {canCreateTasks && (
          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="ts-action-button"
            style={
              styles.newTaskButton
            }
          >
            <Plus size={18} />
            New Task
          </button>
          )}
          </div>
        </div>

        {/* =================================================
            ERRORS
        ================================================= */}

        {workspaceDataError && (
          <div
            style={
              styles.workspaceError
            }
          >
            <AlertTriangle
              size={16}
            />

            <span>
              {workspaceDataError}
            </span>

            {getAuthToken() ? (
              <button
                type="button"
                onClick={
                  loadWorkspaceData
                }
                style={
                  styles.retryButton
                }
              >
                <RotateCcw
                  size={13}
                />

                Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  (window.location.href =
                    "/login")
                }
                style={
                  styles.retryButton
                }
              >
                <LogIn size={13} />

                Go to Login
              </button>
            )}
          </div>
        )}

        {tasksError && (
          <div
            style={
              styles.workspaceError
            }
          >
            <AlertTriangle
              size={16}
            />

            <span>
              {tasksError}
            </span>

            <button
              type="button"
              onClick={() =>
                loadTasks()
              }
              style={
                styles.retryButton
              }
            >
              <RotateCcw
                size={13}
              />

              Retry
            </button>
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            style={{
              ...styles.workspaceError,
              background: "#EAF8F1",
              borderColor: "#BDE5D0",
              color: "#17724A",
            }}
          >
            <CheckCircle2 size={16} />
            <span style={{ flex: 1 }}>{actionMessage}</span>
          </div>
        )}

        {showImport && (
          <CsvImportDialog
            endpoint="/api/tasks/import"
            title="Import tasks from CSV"
            help="Columns: Title*, Date* (YYYY-MM-DD), Time (HH:mm), Department, Assignee (name or email), Status, Priority, Description, Reference ID. Rows are checked before anything is saved."
            columns={[
              { key: "title", label: "Title" },
              { key: "date", label: "Date" },
              { key: "assignee", label: "Assignee" },
              { key: "department", label: "Department" },
              { key: "priority", label: "Priority" },
            ]}
            template={{
              filename: "tasks-import-template.csv",
              header: "Title,Date,Time,Department,Assignee,Status,Priority,Description,Reference ID",
              sample: ["Prepare monthly report,2026-11-05,17:00,Development,john@example.com,Pending,High,Collect KPIs,REF-101"],
            }}
            onClose={() => setShowImport(false)}
            onImported={(result) => {
              setShowImport(false);
              setActionMessage(result.message || "Tasks imported.");
              loadTasks({ silent: true }).catch(() => {});
            }}
          />
        )}

        {taskToDelete &&
          createPortal(
            <div
              className="ts-modal-overlay"
              style={styles.modalOverlay}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) {
                  setTaskToDelete(null);
                }
              }}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="ts-delete-title"
                style={{
                  ...styles.modal,
                  maxWidth: 420,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "#FDECEE",
                      color: "#A83C55",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h3 id="ts-delete-title" style={{ margin: 0, fontSize: 17, color: colors.navy }}>
                      Delete this task?
                    </h3>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
                      <strong>{taskToDelete.name}</strong>
                      {taskToDelete.assignedUser ? ` (assigned to ${taskToDelete.assignedUser})` : ""} and
                      its attachments will be permanently removed.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setTaskToDelete(null)}
                    disabled={deleting}
                    style={styles.retryButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteTask}
                    disabled={deleting}
                    autoFocus
                    style={{
                      ...styles.retryButton,
                      background: "#A83C55",
                      borderColor: "#A83C55",
                      color: "#fff",
                      opacity: deleting ? 0.7 : 1,
                    }}
                  >
                    {deleting ? <Loader2 size={13} style={styles.spinner} /> : <Trash2 size={13} />}
                    {deleting ? "Deleting..." : "Delete task"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {actionError && (
          <div
            style={
              styles.workspaceError
            }
          >
            <AlertTriangle
              size={16}
            />

            <span
              style={{
                flex: 1,
              }}
            >
              {actionError}
            </span>

            <button
              type="button"
              onClick={() =>
                setActionError("")
              }
              style={
                styles.retryButton
              }
            >
              <X size={13} />

              Dismiss
            </button>
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div
          style={
            styles.statsGrid
          }
        >
          <StatCard
            index={0}
            label="TOTAL TASKS"
            value={stats.total}
            description="All workspace tasks"
            icon={ListChecks}
          />

          <StatCard
            index={1}
            label="TO DO"
            value={stats.todo}
            description="Waiting to start"
            icon={Circle}
          />

          <StatCard
            index={2}
            label="IN PROGRESS"
            value={stats.progress}
            description="Active work"
            icon={Clock3}
          />

          <StatCard
            index={3}
            label="REVIEW"
            value={stats.review}
            description="Awaiting review"
            icon={Eye}
          />

          <StatCard
            index={4}
            label="COMPLETED"
            value={stats.completed}
            description="Finished tasks"
            icon={CheckCircle2}
          />
        </div>

        {/* =================================================
            ANIMATED STATUS PIPELINE
        ================================================= */}

        <div
          className="ts-pipeline"
          style={
            styles.pipeline
          }
        >
          <div
            style={
              styles.pipelineHeader
            }
          >
            <div
              style={
                styles.pipelineTitle
              }
            >
              <Target
                size={15}
                color={
                  colors.ocean
                }
              />

              Workflow Flow

              <Zap
                size={13}
                color={
                  colors.ocean
                }
              />
            </div>

            <span
              style={
                styles.pipelineHint
              }
            >
              {stats.completed} completed ·{" "}
              {stats.progress} active
            </span>
          </div>

          <div
            className="ts-pipeline-track"
            style={
              styles.pipelineTrack
            }
          >
            {TASK_STATUSES.map(
              (
                statusName,
                index
              ) => {
                const config =
                  statusConfig[
                    statusName
                  ];

                const Icon =
                  config.icon;

                const count =
                  tasks.filter(
                    (task) =>
                      normalizeStatus(
                        task.status
                      ) ===
                      statusName
                  ).length;

                return (
                  <div
                    key={
                      statusName
                    }
                    className="ts-pipeline-step"
                    style={
                      styles.pipelineStep
                    }
                  >
                    <div
                      style={
                        styles.pipelineStepInner
                      }
                    >
                      <div
                        className="ts-pipeline-dot"
                        style={{
                          ...styles.pipelineDot,
                          background:
                            config.background,
                          color:
                            config.color,
                          borderColor:
                            colors.white,
                        }}
                      >
                        <Icon
                          size={12}
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            ...styles.pipelineLabel,
                            color:
                              config.color,
                          }}
                        >
                          {statusName}
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color:
                              colors.muted,
                            fontWeight: 700,
                          }}
                        >
                          {count}{" "}
                          task
                          {count !==
                          1
                            ? "s"
                            : ""}
                        </div>
                      </div>
                    </div>

                    {index <
                      TASK_STATUSES.length -
                        1 && (
                      <span
                        className="ts-pipeline-wave"
                        style={
                          styles.pipelineWave
                        }
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 140 32"
                          preserveAspectRatio="none"
                          className="ts-pipeline-wave-svg"
                        >
                          <path
                            d="M0 16 C18 3, 32 3, 50 16 S82 29, 100 16 S122 3, 140 16"
                            pathLength="1"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div
          className="ts-search-card"
          style={
            styles.filterCard
          }
        >
          <div
            style={
              styles.searchWrapper
            }
          >
            <Search size={17} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search tasks, users, departments..."
              style={
                styles.searchInput
              }
            />
          </div>

          <div
            style={
              styles.filterSelectWrapper
            }
          >
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option>
                All Status
              </option>

              {TASK_STATUSES.map(
                (status) => (
                  <option
                    key={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>

            <ChevronDown
              size={14}
              style={{
                position:
                  "absolute",
                right: 9,
                pointerEvents:
                  "none",
              }}
            />
          </div>

          <div
            style={
              styles.filterSelectWrapper
            }
          >
            <select
              value={
                priorityFilter
              }
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value
                )
              }
              style={
                styles.filterSelect
              }
            >
              <option>
                All Priority
              </option>

              {Object.keys(
                priorityConfig
              ).map((priority) => (
                <option
                  key={priority}
                >
                  {priority}
                </option>
              ))}
            </select>

            <ChevronDown
              size={14}
              style={{
                position:
                  "absolute",
                right: 9,
                pointerEvents:
                  "none",
              }}
            />
          </div>
        </div>

        {/* =================================================
            TASK WORKSPACE
        ================================================= */}

        <div
          className="ts-workspace-card"
          style={
            styles.taskContainer
          }
        >
          <div
            style={
              styles.taskHeader
            }
          >
            <div>
              <h2
                style={
                  styles.taskTitle
                }
              >
                Workspace Tasks
              </h2>

              <p
                style={
                  styles.taskDescription
                }
              >
                {filteredTasks.length}{" "}
                task
                {filteredTasks.length !==
                1
                  ? "s"
                  : ""}{" "}
                found · Connected to your task database
              </p>
            </div>

            <div
              style={
                styles.taskToolbar
              }
            >
              <button
                type="button"
                className="ts-refresh"
                onClick={
                  handleRefresh
                }
                style={{
                  ...styles.refreshButton,
                  opacity:
                    refreshing
                      ? 0.55
                      : 1,
                  cursor:
                    refreshing
                      ? "wait"
                      : "pointer",
                }}
                title="Refresh workspace"
                disabled={
                  refreshing
                }
              >
                <RefreshCw
                  size={15}
                  style={
                    refreshing
                      ? styles.spinner
                      : undefined
                  }
                />
              </button>

              <div
                style={
                  styles.viewSwitcher
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "rows"
                    )
                  }
                  style={{
                    ...styles.viewButton,
                    ...(viewMode ===
                    "rows"
                      ? styles.viewButtonActive
                      : {}),
                  }}
                >
                  <Rows3
                    size={15}
                  />

                  Rows
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode(
                      "columns"
                    )
                  }
                  style={{
                    ...styles.viewButton,
                    ...(viewMode ===
                    "columns"
                      ? styles.viewButtonActive
                      : {}),
                  }}
                >
                  <Columns3
                    size={15}
                  />

                  Columns
                </button>
              </div>

              {canCreateTasks && (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                style={
                  styles.smallCreateButton
                }
              >
                <Plus size={15} />

                Create Task
              </button>
              )}
            </div>
          </div>

          {tasksLoading ? (
            <div
              style={
                styles.tasksLoading
              }
            >
              <Loader2
                size={20}
                style={
                  styles.spinner
                }
              />

              <span>
                Loading workspace...
              </span>
            </div>
          ) : filteredTasks.length ===
            0 ? (
            <div
              style={
                styles.emptyState
              }
            >
              <div
                style={
                  styles.emptyIcon
                }
              >
                <Waves size={31} />
              </div>

              <h3
                style={
                  styles.emptyTitle
                }
              >
                No tasks in this view
              </h3>

              <p
                style={
                  styles.emptyText
                }
              >
                Create a new task or adjust your filters to see more work.
              </p>

              {canCreateTasks && (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                style={
                  styles.emptyButton
                }
              >
                <Plus size={17} />

                Create New Task
              </button>
              )}
             
            </div>
           
          ) : viewMode ===
            "rows" ? (
            <div
              style={
                styles.taskList
              }
            >
              {filteredTasks.map(
                (
                  task,
                  index
                ) => (
                  <TaskCard
                    key={
                      task.id
                    }
                    task={task}
                    visibleFields={
                      visibleFields
                    }
                    onStatusChange={
                      handleStatusChange
                    }
                    onEdit={editHandlerFor(
                      task
                    )}
                    onDelete={deleteHandlerFor(
                      task
                    )}
                    animationIndex={
                      index
                    }
                    statusUpdating={Boolean(
                      updatingTaskIds[
                        task.id
                      ]
                    )}
                  />
                )
              )}
            </div>
          ) : (
            <div
              style={
                styles.columnBoard
              }
            >
              {TASK_STATUSES.map(
                (statusName) => {
                  const columnTasks =
                    filteredTasks.filter(
                      (task) =>
                        normalizeStatus(
                          task.status
                        ) ===
                        statusName
                    );

                  const status =
                    statusConfig[
                      statusName
                    ];

                  const StatusIcon =
                    status.icon;

                  return (
                    <div
                      key={
                        statusName
                      }
                      style={
                        styles.boardColumn
                      }
                    >
                      <div
                        style={
                          styles.boardColumnHeader
                        }
                      >
                        <div
                          style={
                            styles.boardColumnTitle
                          }
                        >
                          <span
                            style={{
                              ...styles.boardStatusDot,
                              background:
                                status.color,
                              boxShadow:
                                `0 0 0 4px ${status.background}`,
                            }}
                          />

                          <StatusIcon
                            size={14}
                          />

                          <strong>
                            {statusName}
                          </strong>
                        </div>

                        <span
                          style={
                            styles.boardCount
                          }
                        >
                          {
                            columnTasks.length
                          }
                        </span>
                      </div>

                      <div
                        style={
                          styles.boardColumnBody
                        }
                      >
                        {columnTasks.length ===
                        0 ? (
                          <div
                            style={
                              styles.boardEmpty
                            }
                          >
                            No tasks
                          </div>
                        ) : (
                          columnTasks.map(
                            (
                              task,
                              index
                            ) => (
                              <TaskCard
                                key={
                                  task.id
                                }
                                task={
                                  task
                                }
                                visibleFields={
                                  visibleFields
                                }
                                onStatusChange={
                                  handleStatusChange
                                }
                                onEdit={editHandlerFor(
                                  task
                                )}
                                onDelete={deleteHandlerFor(
                                  task
                                )}
                                animationIndex={
                                  index
                                }
                                boardMode
                                statusUpdating={Boolean(
                                  updatingTaskIds[
                                    task.id
                                  ]
                                )}
                              />
                            )
                          )
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* =================================================
            MODAL
        ================================================= */}

        {showModal &&
          createPortal(
            <TaskFormModal
              key={
                editingTask
                  ? `edit-${editingTask.id}`
                  : "create"
              }
              onClose={() => {
                setShowModal(
                  false
                );
                setEditingTask(
                  null
                );
              }}
              onCreate={
                handleCreateTask
              }
              onUpdate={
                handleUpdateTask
              }
              editingTask={
                editingTask
              }
              departments={
                departments
              }
              users={users}
            />,
            document.body
          )}
      </div>
    </>
  );
};

/* =========================================================
   STAT CARD
========================================================= */

const StatCard = ({
  label,
  value,
  description,
  icon: Icon,
  index = 0,
}) => {
  // Ocean-only palette: every statistic card stays within the TaskSphere ocean theme.
  const tone =
    index === 0
      ? {
          accent: "#16A6B8",
          soft: "#E6F8FA",
          glow:
            "rgba(22,166,184,.24)",
          mini: "Overview",
        }
      : index === 1
      ? {
          accent: "#1677A8",
          soft: "#EAF5FA",
          glow:
            "rgba(22,119,168,.22)",
          mini: "Queued",
        }
      : index === 2
      ? {
          accent: "#08798C",
          soft: "#E7F8FA",
          glow:
            "rgba(8,121,140,.22)",
          mini: "Live",
        }
      : index === 3
      ? {
          accent: "#2F83B1",
          soft: "#EAF4FB",
          glow:
            "rgba(47,131,177,.22)",
          mini: "Check",
        }
      : {
          accent: "#123B5D",
          soft: "#E8F2F7",
          glow:
            "rgba(18,59,93,.20)",
          mini: "Done",
        };

  return (
    <div
      className="ts-stat-card"
      style={{
        ...styles.statCard,
        animationDelay:
          `${index * 80}ms`,
        "--stat-accent":
          tone.accent,
        "--stat-soft":
          tone.soft,
        "--stat-glow":
          tone.glow,
      }}
    >
      <div
        className="ts-stat-orb"
        style={styles.statOrb}
      />

      <div
        className="ts-stat-orb-two"
        style={
          styles.statOrbTwo
        }
      />

      <Icon
        className="ts-stat-watermark"
        size={78}
      />

      <div
        style={
          styles.statTop
        }
      >
        <div
          style={
            styles.statLabelWrap
          }
        >
          <span
            style={
              styles.statLabelDot
            }
          />

          <span>
            {label}
          </span>
        </div>

        <div
          style={{
            ...styles.statIcon,
            background:
              tone.soft,
            color:
              tone.accent,
            boxShadow:
              `inset 0 0 0 1px ${tone.glow}`,
          }}
        >
          <Icon size={17} />
        </div>
      </div>

      <div
        style={
          styles.statValueRow
        }
      >
        <strong
          style={
            styles.statValue
          }
        >
          {value}
        </strong>

        <span
          style={{
            ...styles.statMiniBadge,
            color:
              tone.accent,
            background:
              tone.soft,
          }}
        >
          {tone.mini}
        </span>
      </div>

      <div
        className="ts-stat-progress"
        style={styles.statProgress}
      >
        <span
          style={{
            ...styles.statProgressFill,
            background:
              `linear-gradient(90deg, ${tone.accent}, ${colors.ocean})`,
            width:
              value > 0
                ? `${Math.min(
                    100,
                    25 + value * 15
                  )}%`
                : "12%",
          }}
        />
      </div>

      <p
        style={
          styles.statDescription
        }
      >
        {description}
      </p>
    </div>
  );
};

/* =========================================================
   TASK CARD
========================================================= */

const TaskCard = ({
  task,
  visibleFields = {},
  onStatusChange,
  onEdit,
  onDelete,
  animationIndex = 0,
  boardMode = false,
  statusUpdating = false,
}) => {
  const priority =
    priorityConfig[
      task.priority
    ];

  const currentStatus =
    normalizeStatus(
      task.status
    );

  const status =
    statusConfig[
      currentStatus
    ];

  const PriorityIcon =
    priority?.icon || Minus;

  const StatusIcon =
    status?.icon || Circle;

  return (
    <div
      className="ts-task-card"
      style={{
        ...styles.taskCard,
        animationDelay:
          `${animationIndex * 55}ms`,
      }}
    >
      <div
        className="ts-task-accent"
        style={{
          ...styles.taskAccent,
          background:
            status?.color ||
            colors.ocean,
        }}
      />

      <div
        className="ts-task-main"
        style={{
          ...styles.taskCardMain,
          ...(boardMode
            ? styles.taskCardMainBoard
            : {}),
        }}
      >
        {/* STATUS ICON */}

        <div
          style={{
            ...styles.taskCheckbox,
            color:
              status?.color,
            background:
              status?.background,
            boxShadow:
              `inset 0 0 0 1px ${status?.color}22`,
          }}
        >
          <StatusIcon size={17} />
        </div>

        {/* TASK INFO */}

        <div
          style={
            styles.taskInfo
          }
        >
          <div
            style={
              styles.taskTopLine
            }
          >
            <h3
              style={
                styles.taskCardTitle
              }
            >
              {task.name}
            </h3>

            {task.referenceId && (
              <span
                style={
                  styles.referenceBadge
                }
              >
                #{task.referenceId}
              </span>
            )}
          </div>

          {task.description && (
            <p
              style={
                styles.taskCardDesc
              }
            >
              {task.description}
            </p>
          )}

          {boardMode && (
            <div
              style={{
                ...styles.boardMiniStatus,
                color:
                  status?.color,
                background:
                  status?.background,
                borderColor:
                  `${status?.color}55`,
              }}
            >
              <StatusIcon
                size={10}
              />

              {currentStatus}

              <span
                style={{
                  opacity:
                    0.6,
                }}
              >
                ·
              </span>

              {status?.description}
            </div>
          )}

          {/* META */}

          <div
            style={
              styles.taskMeta
            }
          >
            {visibleFields.department &&
              task.department && (
                <span
                  style={
                    styles.taskMetaItem
                  }
                >
                  <Building2
                    size={12}
                  />

                  {task.department}
                </span>
              )}

            {visibleFields.assignedUser &&
              task.assignedUser && (
                <span
                  style={
                    styles.taskMetaItem
                  }
                >
                  <UserRound
                    size={12}
                  />

                  {task.assignedUser}
                </span>
              )}

            {visibleFields.dueDate &&
              task.dueDate && (
                <span
                  style={
                    styles.taskMetaItem
                  }
                >
                  <CalendarDays
                    size={12}
                  />

                  {task.dueDate}
                  {task.dueTime ? ` · ${task.dueTime}` : ""}
                </span>
              )}
          </div>

          {/* ATTACHMENTS (saved on the task — download is authenticated) */}

          {Array.isArray(task.attachments) &&
            task.attachments.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {task.attachments.map((file, index) => (
                  <button
                    key={`${file.filename || file.name}-${index}`}
                    type="button"
                    disabled={!file.downloadable}
                    title={
                      file.downloadable
                        ? `Download ${file.name}${file.size ? ` (${formatFileSize(file.size)})` : ""}`
                        : "File not available on the server"
                    }
                    onClick={() =>
                      downloadAttachment(file).catch(() =>
                        window.alert(`Could not download ${file.name}.`)
                      )
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      maxWidth: 220,
                      padding: "4px 9px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      background: colors.white,
                      color: file.downloadable ? colors.ocean : colors.muted,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: file.downloadable ? "pointer" : "not-allowed",
                    }}
                  >
                    <Paperclip size={11} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </span>
                    {file.downloadable && <Download size={11} />}
                  </button>
                ))}
              </div>
            )}

          {/* PROGRESS */}

          <div
            style={
              styles.progressWrap
            }
          >
            <div
              style={
                styles.progressTrack
              }
            >
              <div
                style={{
                  ...styles.progressFill,
                  width:
                    `${status?.progress || 0}%`,
                  background:
                    `linear-gradient(90deg, ${status?.color}, ${colors.ocean})`,
                }}
              />
            </div>

            <span
              style={
                styles.progressText
              }
            >
              {status?.progress ||
                0}
              %
            </span>
          </div>
        </div>

        {/* RIGHT */}

        <div
          className="ts-task-right"
          style={{
            ...styles.taskRight,
            ...(boardMode
              ? styles.taskRightBoard
              : {}),
          }}
        >
          {visibleFields.status &&
            onStatusChange && (
              <div
                style={
                  styles.statusSelectWrapper
                }
              >
                <select
                  value={
                    currentStatus
                  }
                  onChange={(e) =>
                    onStatusChange(
                      task.id,
                      e.target
                        .value
                    )
                  }
                  disabled={
                    statusUpdating
                  }
                  style={{
                    ...styles.statusSelect,
                    borderColor:
                      `${status?.color}55`,
                    background:
                      status?.soft ||
                      colors.white,
                    opacity:
                      statusUpdating
                        ? 0.6
                        : 1,
                    cursor:
                      statusUpdating
                        ? "wait"
                        : "pointer",
                  }}
                  aria-label={`Change status for ${task.name}`}
                >
                  {TASK_STATUSES.map(
                    (s) => (
                      <option
                        key={s}
                        value={s}
                      >
                        {s}
                      </option>
                    )
                  )}
                </select>

                {statusUpdating ? (
                  <Loader2
                    size={12}
                    style={{
                      ...styles.statusSelectIcon,
                      animation:
                        "ts-spin .9s linear infinite",
                    }}
                  />
                ) : (
                  <ChevronDown
                    size={13}
                    style={
                      styles.statusSelectIcon
                    }
                  />
                )}
              </div>
            )}

          {priority && (
            <span
              style={{
                ...styles.priorityBadge,
                color:
                  priority.color,
                background:
                  priority.background,
              }}
            >
              <PriorityIcon
                size={12}
              />

              {task.priority}
            </span>
          )}

          <div
            style={
              styles.taskActions
            }
          >
            {onEdit && (
              <button
                type="button"
                onClick={() =>
                  onEdit(task)
                }
                style={
                  styles.editButton
                }
                title="Edit task"
              >
                <Pencil
                  size={14}
                />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() =>
                  onDelete(
                    task.id
                  )
                }
                style={
                  styles.deleteButton
                }
                title="Delete task"
              >
                <Trash2
                  size={14}
                />
              </button>
            )}

            <button
              type="button"
              style={{
                width: 31,
                height: 31,
                borderRadius: 9,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                border:
                  `1px solid ${colors.border}`,
                background:
                  colors.white,
                color:
                  colors.muted,
                cursor:
                  "default",
              }}
              title={
                status?.description
              }
            >
              <MoreHorizontal
                size={15}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;