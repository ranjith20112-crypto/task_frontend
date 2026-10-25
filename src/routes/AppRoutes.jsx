import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/Login/Login";
import VerifyEmail from "../pages/VerifyEmail/VerifyEmail";

import Chats from "../pages/Dashboard/Chats";
import MainDash from "../pages/Dashboard/maindash";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import UsersPage from "../pages/Dashboard/users";
import TasksPage from "../pages/Dashboard/tasks";
import TaskBank from "../pages/Dashboard/taskbank";
import TaskCalendar from "../pages/Dashboard/taskcalender";
import MinutesOfMeeting from "../pages/Dashboard/mom";
import DashboardChart from "../pages/Dashboard/DashboardChart";
import Support from "../pages/Dashboard/support";
import Roles from "../pages/Dashboard/roles";
import Report from "../pages/Dashboard/report";
import SettingsPage from "../pages/Dashboard/setting";
import SuperAdminDashboard from "../pages/Dashboard/SuperAdminDashboard";

/* 🔒 Route guards (backend enforces the same rules on every API) */
import {
  RequireAuth,
  SuperAdminRoute,
  PermissionRoute,
} from "../components/adminroutes";

/* =========================================================
   COMMON PAGE STYLES
========================================================= */

const pageStyles = {
  page: {
    maxWidth: "1200px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },

  h1: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#18B3B2",
    margin: "0 0 6px 0",
  },

  desc: {
    fontSize: "15px",
    color: "#6b7280",
    margin: "0 0 24px 0",
    fontWeight: "400",
  },
};

/* =========================================================
   FALLBACK / SIMPLE PAGES
========================================================= */

const TaskBankPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Task Bank</h1>
    <p style={pageStyles.desc}>
      Browse and manage task templates
    </p>
  </div>
);

const TaskCalendarPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Task Calendar</h1>
    <p style={pageStyles.desc}>
      View and manage tasks on a calendar
    </p>
  </div>
);

const MoMPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>MoM</h1>
    <p style={pageStyles.desc}>
      Minutes of meeting
    </p>
  </div>
);

const ChatsPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Chats</h1>
    <p style={pageStyles.desc}>
      Team communication
    </p>
  </div>
);

const SupportPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Support</h1>
    <p style={pageStyles.desc}>
      Help and support tickets
    </p>
  </div>
);

const RolesPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Roles</h1>
    <p style={pageStyles.desc}>
      Manage roles and access
    </p>
  </div>
);

const ReportsPage = () => (
  <div style={pageStyles.page}>
    <h1 style={pageStyles.h1}>Reports</h1>
    <p style={pageStyles.desc}>
      Analytics and reports
    </p>
  </div>
);

/* =========================================================
   APP ROUTES
========================================================= */

const AppRoutes = () => {
  return (
    <Routes>

      {/* =====================================================
          LOGIN
      ===================================================== */}

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      {/* Public — link from the verification email (one-time password reveal) */}
      <Route
        path="/verify-email/:token"
        element={<VerifyEmail />}
      />

      {/* =====================================================
          DASHBOARD LAYOUT

          MainDash must contain <Outlet />
          so these pages render inside MainDash.
      ===================================================== */}

      <Route
        element={
          <RequireAuth>
            <MainDash />
          </RequireAuth>
        }
      >

        {/* =================================================
            SUPER ADMIN DASHBOARD
            🔒 SuperAdmin only
        ================================================= */}

        <Route
          path="/superadmin/dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        {/* =================================================
            DASHBOARD
        ================================================= */}

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        {/* =================================================
            USERS
            🔒 CHANGED: admin only
        ================================================= */}

        <Route
          path="/dashboard/users"
          element={
            <PermissionRoute module="users">
              <UsersPage />
            </PermissionRoute>
          }
        />

        {/* =================================================
            TASKS
        ================================================= */}

        <Route
          path="/dashboard/tasks"
          element={
            <PermissionRoute module="tasks">
              <TasksPage />
            </PermissionRoute>
          }
        />

        {/* =================================================
            TASK BANK
        ================================================= */}

        <Route
          path="/dashboard/task-bank"
          element={
            <PermissionRoute module="taskbank">
              <TaskBank />
            </PermissionRoute>
          }
        />

        {/* =================================================
            TASK CALENDAR
        ================================================= */}

        <Route
          path="/dashboard/task-calendar"
          element={
            <PermissionRoute module="calendar">
              <TaskCalendar />
            </PermissionRoute>
          }
        />

        {/* =================================================
            MINUTES OF MEETING
        ================================================= */}

        <Route
          path="/dashboard/mom"
          element={
            <PermissionRoute module="communication">
              <MinutesOfMeeting />
            </PermissionRoute>
          }
        />

        {/* =================================================
            CHATS
        ================================================= */}

        <Route
          path="/dashboard/chats"
          element={
            <PermissionRoute module="chat">
              <DashboardChart />
            </PermissionRoute>
          }
        />

        {/* =================================================
            SUPPORT
        ================================================= */}

        <Route
          path="/dashboard/support"
          element={
            <PermissionRoute module="support">
              <Support />
            </PermissionRoute>
          }
        />

        {/* =================================================
            ROLES
            🔒 CHANGED: admin only
        ================================================= */}

        <Route
          path="/dashboard/roles"
          element={
            <PermissionRoute module="users" action="assign" roles={["SuperAdmin", "Admin"]}>
              <Roles />
            </PermissionRoute>
          }
        />

        {/* =================================================
            REPORTS
        ================================================= */}

        <Route
          path="/dashboard/reports"
          element={
            <PermissionRoute module="reports">
              <Report />
            </PermissionRoute>
          }
        />

        {/* =================================================
            SETTINGS

            IMPORTANT:
            This is your actual setting.jsx component.
            🔒 Personal settings — any role with settings.view
        ================================================= */}

        <Route
          path="/dashboard/settings"
          element={
            <PermissionRoute module="settings">
              <SettingsPage />
            </PermissionRoute>
          }
        />

      </Route>

      {/* =====================================================
          UNKNOWN URL
      ===================================================== */}

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />

    </Routes>
  );
};

export default AppRoutes;