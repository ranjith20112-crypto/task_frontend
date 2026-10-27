// src/services/reportApi.js
// FIX: the old address was "https://task-backend-mn8a.onrender.comapi"
// (missing "/" before "api"), so every report request failed.
// This always ends up as "https://task-backend-mn8a.onrender.com/api",
// whether VITE_API_URL ends with "/api" or not.
const API_BASE =
  String(import.meta.env.VITE_API_URL || "https://task-backend-mn8a.onrender.com")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "") + "/api";

// Reads the token saved at login
const getAuthToken = () =>
  (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    ""
  ).replace(/^"|"$/g, "");

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildParams = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return params.toString();
};

// Network / CORS failures give a clear message instead of "Failed to fetch"
const request = async (url) => {
  try {
    return await fetch(url, { headers: authHeaders(), credentials: "omit" });
  } catch {
    throw new Error(`Cannot reach the server at ${API_BASE}. Please try again.`);
  }
};

export const getReportSummary = async (filters = {}) => {
  const res = await request(`${API_BASE}/reports/summary?${buildParams(filters)}`);

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    if (res.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }
    if (res.status === 404) {
      throw new Error("Report route not found on the server (GET /api/reports/summary).");
    }
    throw new Error(json.message || `Failed to load report (${res.status})`);
  }

  return json.data || json;
};

export const exportReportCSV = async (filters = {}) => {
  const res = await request(`${API_BASE}/reports/export?${buildParams(filters)}`);

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }
    let message = `Export failed (${res.status})`;
    try {
      const json = JSON.parse(text);
      if (json.message) message = json.message;
    } catch {
      // response wasn't JSON — keep default message
    }
    throw new Error(message);
  }

  // ﻿ lets Excel open the file with the right encoding
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `task-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
