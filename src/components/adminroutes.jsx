import React from "react";
import { Navigate } from "react-router-dom";
import { getStoredUser, hasPermission, homePathFor } from "../services/permissions";

/* =========================================================
   🔒 ROUTE GUARDS
   These only decide what to RENDER — every API is also
   protected on the backend, so editing localStorage or the
   URL never grants real access.
========================================================= */

// Logged-in users only
export const RequireAuth = ({ children }) => {
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
};

// SuperAdmin only
export const SuperAdminRoute = ({ children }) => {
  const user = getStoredUser();
  if (user?.role !== "SuperAdmin") {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return children;
};

// Module permission (e.g. module="users" → needs users.view)
export const PermissionRoute = ({ module, action = "view", roles, children }) => {
  const user = getStoredUser();
  const roleOk = !roles || roles.includes(user?.role);
  if (!roleOk || !hasPermission(user, module, action)) {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return children;
};

/* Admin / SuperAdmin → page shows | others → redirected (kept for existing imports) */
const AdminRoute = ({ children }) => {
  const user = getStoredUser();
  if (!["Admin", "SuperAdmin"].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export default AdminRoute;
