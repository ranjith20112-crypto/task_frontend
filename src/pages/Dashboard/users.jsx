// TaskSphere UsersPage — Unique Ocean Flow Edition (fixed)
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import {
  Users,
  Building2,
  ShieldCheck,
  UserRoundCog,
  Search,
  Upload,
  Pencil,
  Trash2,
  Mail,
  Phone,
  BriefcaseBusiness,
  UserPlus,
  UserX,
  Building,
  ArrowUpRight,
  X,
  Plus,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  Activity,
  TrendingUp,
  BarChart3,
  Waves,
  CalendarDays,
  UserRound,
} from "lucide-react";

/* =========================================================
   API CONFIG
   FIX 1: backend routes live under /api  (Postman: /api/users)
   FIX 2: Bearer-token auth → no cookies needed. withCredentials:true
          breaks CORS when the backend uses origin "*".
          Set USE_COOKIES = true only if your backend sets an auth cookie
          AND its CORS config has credentials:true + an exact origin.
========================================================= */

const API_ORIGIN = "https://task-backend-mn8a.onrender.com";
const API_BASE = `${API_ORIGIN}/api`;
const USE_COOKIES = false;

const TOKEN_KEYS = ["token", "authToken", "accessToken", "jwt", "userToken"];

const getAuthToken = () => {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (token) return token.replace(/^"|"$/g, "");
  }
  return null;
};

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: USE_COOKIES,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      TOKEN_KEYS.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      localStorage.removeItem("user");
      // send the user back to login instead of leaving a broken page
      if (!window.location.pathname.startsWith("/login")) {
        setTimeout(() => window.location.assign("/login"), 1200);
      }
    }
    return Promise.reject(error);
  }
);

// Accepts [..], {data:[..]}, {data:{key:[..]}}, {key:[..]}
const extractList = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (key && Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (key && Array.isArray(payload?.[key])) return payload[key];
  return [];
};

// A field may come back as a string, an ObjectId string, or a populated object
const nameOf = (value) =>
  value && typeof value === "object" ? value.name || "" : value || "";
const idOf = (value) =>
  value && typeof value === "object" ? value._id || value.id || "" : value || "";

const errMsg = (error, fallback) =>
  error.response?.data?.message ||
  (error.response?.status === 404
    ? `API route not found: ${error.config?.baseURL || ""}${error.config?.url || ""}`
    : error.code === "ERR_NETWORK"
    ? "Cannot reach the server (network / CORS). Check backend CORS settings."
    : error.message) ||
  fallback;

/* Role names come from the backend (GET /api/permissions/catalog). */
const ROLE_LABELS = {
  SuperAdmin: "Super Admin",
  Admin: "Admin",
  Manager: "Manager",
  User: "Team Member",
};

const roleLabel = (role) => ROLE_LABELS[role] || role || "Team Member";

// CSV / free-text role → backend enum value
const toRoleValue = (value) => {
  const v = String(value || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (v === "admin") return "Admin";
  if (v === "manager") return "Manager";
  if (v === "superadmin") return "SuperAdmin";
  return "User";
};

const getSessionUser = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("user") || "null");
    // some login responses store { user: {...}, token }
    return raw?.user && !raw.role ? raw.user : raw;
  } catch {
    return null;
  }
};

// FIX 3: if the stored user has no permissions map, Admin still gets full
// access in the UI (the backend keeps enforcing the real rules).
const canDo = (user, moduleId, action) => {
  if (!user) return false;
  if (user.role === "SuperAdmin") return true;
  const perms = user.permissions;
  if (!perms || typeof perms !== "object" || !Object.keys(perms).length) {
    return user.role === "Admin";
  }
  return Boolean(perms?.[moduleId]?.includes(action));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const UsersPage = () => {
  const [activeTab, setActiveTab] = useState("users");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [role, setRole] = useState("All Roles");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sessionUser] = useState(getSessionUser);
  const isSuperAdmin = sessionUser?.role === "SuperAdmin";
  const canCreateUsers = canDo(sessionUser, "users", "create");
  const canEditUsers = canDo(sessionUser, "users", "edit");
  const canDeleteUsers = canDo(sessionUser, "users", "delete");
  const canAssignRoles = canDo(sessionUser, "users", "assign");

  const [assignableRoles, setAssignableRoles] = useState([]);
  const [organizations, setOrganizations] = useState([]);

  const [customRoles, setCustomRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    baseRole: "User",
    adminId: "",
  });
  const [savingRole, setSavingRole] = useState(false);

  const [resetRequests, setResetRequests] = useState([]);
  const [resendingId, setResendingId] = useState(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteDeptModal, setShowDeleteDeptModal] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteDept, setDeleteDept] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [importing, setImporting] = useState(false);

  const emptyUserForm = {
    name: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    role: "User",
    adminId: "",
  };

  const [userForm, setUserForm] = useState(emptyUserForm);
  const [departmentForm, setDepartmentForm] = useState({ name: "", description: "" });

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* =========================================================
     FETCHERS
  ========================================================= */

  const fetchCustomRoles = async () => {
    try {
      const response = await api.get("/custom-roles");
      setCustomRoles(extractList(response.data, "roles"));
    } catch (error) {
      console.error("GET /api/custom-roles failed:", error.response?.data || error);
    }
  };

  const fetchResetRequests = async () => {
    if (!canEditUsers) return;
    try {
      const response = await api.get("/password-requests");
      setResetRequests(
        extractList(response.data, "requests").filter((r) => r && r.user)
      );
    } catch (error) {
      console.error("GET /api/password-requests failed:", error.response?.data || error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      const apiUsers = extractList(response.data, "users");

      setUsers(
        apiUsers.filter(Boolean).map((user) => ({
          id: user._id || user.id,
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          department: nameOf(user.department),
          role: user.role || "User",
          status: user.status || "Active",
          adminId: idOf(user.admin_id || user.adminId),
          organization: nameOf(user.organization),
          emailVerified: user.emailVerified !== false,
          customRoleId: idOf(user.customRole),
          customRoleName:
            user.customRoleName ||
            (typeof user.customRole === "object" ? user.customRole?.name : "") ||
            "",
          avatar: user.name?.charAt(0)?.toUpperCase() || "U",
        }))
      );
    } catch (error) {
      console.error("GET /api/users failed:", error.response?.data || error);
      showToast(
        error.response?.status === 401
          ? "Session expired. Please log in again."
          : errMsg(error, "Failed to load users from server."),
        "error"
      );
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/departments", { params: { _t: Date.now() } });
      const apiDepts = extractList(response.data, "departments");

      setDepartments(
        apiDepts.filter(Boolean).map((dept) => ({
          id: dept._id || dept.id,
          name: dept.name || "",
          description: dept.description || "Organization department",
          status: dept.status || "Active",
        }))
      );
    } catch (error) {
      console.error("GET /api/departments failed:", error.response?.data || error);
      showToast(errMsg(error, "Failed to load departments."), "error");
    }
  };

  const fetchRoleOptions = async () => {
    try {
      const response = await api.get("/permissions/catalog");
      const roles =
        response.data?.data?.assignableRoles || response.data?.assignableRoles || [];
      // fallback so the Role dropdown is never empty
      setAssignableRoles(
        roles.length
          ? roles
          : [
              ...(isSuperAdmin ? [{ value: "Admin", label: "Admin" }] : []),
              { value: "Manager", label: "Manager" },
              { value: "User", label: "Team Member" },
            ]
      );
    } catch (error) {
      console.error("GET /api/permissions/catalog failed:", error.response?.data || error);
      setAssignableRoles([
        { value: "Manager", label: "Manager" },
        { value: "User", label: "Team Member" },
      ]);
    }

    if (isSuperAdmin) {
      try {
        const response = await api.get("/admins");
        setOrganizations(
          extractList(response.data, "admins").map((admin) => ({
            id: admin._id || admin.id,
            name: admin.name,
          }))
        );
      } catch (error) {
        console.error("GET /api/admins failed:", error.response?.data || error);
      }
    }
  };

  useEffect(() => {
    if (!getAuthToken()) {
      showToast("You are not logged in. Please log in again.", "error");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchDepartments(),
        fetchRoleOptions(),
        fetchResetRequests(),
        fetchCustomRoles(),
      ]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     ROLES (organization-defined)
  ========================================================= */

  const rolesForOrg = (orgId) =>
    customRoles.filter(
      (r) => !isSuperAdmin || !orgId || String(idOf(r.admin_id)) === String(orgId)
    );

  const openRoleModal = (r = null) => {
    setEditingRole(r);
    setRoleForm({
      name: r?.name || "",
      description: r?.description || "",
      baseRole: r?.baseRole || "User",
      adminId: idOf(r?.admin_id) || organizations[0]?.id || "",
    });
    setShowRoleModal(true);
  };

  const saveRole = async (event) => {
    event.preventDefault();
    if (!roleForm.name.trim()) {
      showToast("Role name is required.", "error");
      return;
    }
    if (isSuperAdmin && !editingRole && !roleForm.adminId) {
      showToast("Select the organization for this role.", "error");
      return;
    }
    setSavingRole(true);
    try {
      const body = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        baseRole: roleForm.baseRole,
        ...(isSuperAdmin && !editingRole ? { adminId: roleForm.adminId } : {}),
      };
      const response = editingRole
        ? await api.put(`/custom-roles/${editingRole._id}`, body)
        : await api.post("/custom-roles", body);
      showToast(response.data?.message || "Role saved.");
      setShowRoleModal(false);
      await Promise.all([fetchCustomRoles(), fetchUsers()]);
    } catch (error) {
      showToast(errMsg(error, "Failed to save the role."), "error");
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = async (r) => {
    if (!window.confirm(`Delete the role "${r.name}"?`)) return;
    try {
      const response = await api.delete(`/custom-roles/${r._id}`);
      showToast(response.data?.message || "Role deleted.");
      await Promise.all([fetchCustomRoles(), fetchUsers()]);
    } catch (error) {
      showToast(errMsg(error, "Failed to delete the role."), "error");
    }
  };

  /* =========================================================
     VERIFICATION / RESET REQUESTS
  ========================================================= */

  const resendVerification = async (user) => {
    setResendingId(user.id);
    try {
      const response = await api.post(`/users/${user.id}/resend-verification`);
      showToast(response.data?.message || "Verification email sent.");
    } catch (error) {
      showToast(errMsg(error, "Failed to resend the verification email."), "error");
    } finally {
      setResendingId(null);
    }
  };

  const dismissResetRequest = async (request) => {
    try {
      await api.patch(`/password-requests/${request._id}/dismiss`);
      setResetRequests((prev) => prev.filter((r) => r._id !== request._id));
      showToast("Request dismissed.");
    } catch (error) {
      showToast(errMsg(error, "Failed to dismiss the request."), "error");
    }
  };

  /* =========================================================
     FILTER USERS
  ========================================================= */

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phone?.includes(query);

      const matchesDepartment =
        department === "All Departments" || user.department === department;

      const matchesRole =
        role === "All Roles" ||
        (role.startsWith("custom:")
          ? String(user.customRoleId) === role.slice(7)
          : user.role === role && !user.customRoleId);

      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [users, search, department, role]);

  /* =========================================================
     STATS
  ========================================================= */

  const totalUsers = users.length;
  const totalDepartments = departments.length;
  const totalAdmins = users.filter((u) => u.role === "Admin").length;
  const totalManagers = users.filter((u) => u.role === "Manager").length;
  const activeUsers = users.filter((u) => u.status === "Active").length;

  const departmentStats = useMemo(
    () =>
      departments.map((dept) => ({
        ...dept,
        count: users.filter((u) => u.department === dept.name).length,
      })),
    [users, departments]
  );

  const maxDepartmentCount = Math.max(...departmentStats.map((i) => i.count), 1);

  const deptMemberCount = deleteDept
    ? users.filter((u) => u.department === deleteDept.name).length
    : 0;

  /* =========================================================
     ACTIVITY TREND (illustrative)
  ========================================================= */

  const activityTrend = useMemo(() => {
    const base = Math.max(totalUsers, 1);
    return [0.35, 0.55, 0.48, 0.7, 0.85, 1].map((f) => Math.round(base * f));
  }, [totalUsers]);

  const chartW = 600;
  const chartH = 190;
  const maxTrend = Math.max(...activityTrend, 1);

  const chartPoints = activityTrend.map((value, index) => ({
    x: 14 + (index * (chartW - 28)) / (activityTrend.length - 1),
    y: 16 + (1 - value / maxTrend) * (chartH - 40),
  }));

  const linePath = chartPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${chartW - 14},${chartH - 2} L 14,${chartH - 2} Z`;

  const clearFilters = () => {
    setSearch("");
    setDepartment("All Departments");
    setRole("All Roles");
  };

  /* =========================================================
     USER MODALS
  ========================================================= */

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({
      ...emptyUserForm,
      role: assignableRoles.some((r) => r.value === "User")
        ? "User"
        : assignableRoles[0]?.value || "User",
      adminId: organizations[0]?.id || "",
      department: departments[0]?.name || "",
    });
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      department: user.department || "",
      role: user.customRoleId ? `custom:${user.customRoleId}` : user.role || "User",
      adminId: user.adminId || "",
    });
    setShowUserModal(true);
  };

  const openDeleteUser = (user) => {
    setDeleteUser(user);
    setShowDeleteModal(true);
  };

  const openDeleteDept = (dept) => {
    setDeleteDept(dept);
    setShowDeleteDeptModal(true);
  };

  /* =========================================================
     SAVE USER
  ========================================================= */

  const handleSaveUser = async (event) => {
    event.preventDefault();

    if (
      !userForm.name.trim() ||
      !userForm.email.trim() ||
      !userForm.phone.trim() ||
      !userForm.department ||
      !userForm.role
    ) {
      showToast("Please complete all required fields.", "error");
      return;
    }

    if (!editingUser && !userForm.password.trim()) {
      showToast("Password is required for a new user.", "error");
      return;
    }

    if (isSuperAdmin && !editingUser && userForm.role !== "Admin" && !userForm.adminId) {
      showToast("Select the organization (Admin) for this user.", "error");
      return;
    }

    if (userForm.password.trim() && userForm.password.trim().length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        const before = editingUser.customRoleId
          ? `custom:${editingUser.customRoleId}`
          : editingUser.role;

        let roleChange = {};
        if (userForm.role !== before) {
          roleChange = userForm.role.startsWith("custom:")
            ? { customRoleId: userForm.role.slice(7) }
            : {
                role: userForm.role,
                ...(editingUser.customRoleId ? { customRoleId: "" } : {}),
              };
        }

        const response = await api.put(`/users/${editingUser.id}`, {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          department: userForm.department,
          status: editingUser.status || "Active",
          ...roleChange,
          ...(userForm.password.trim() ? { password: userForm.password.trim() } : {}),
        });

        showToast(response.data?.message || "User updated successfully.");
        if (userForm.password.trim()) await fetchResetRequests();
      } else {
        const response = await api.post("/users", {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          password: userForm.password.trim(),
          phone: userForm.phone.trim(),
          department: userForm.department,
          status: "Active",
          ...(userForm.role.startsWith("custom:")
            ? { customRoleId: userForm.role.slice(7) }
            : { role: userForm.role }),
          ...(isSuperAdmin && userForm.role !== "Admin"
            ? { adminId: userForm.adminId }
            : {}),
        });

        showToast(
          response.data?.message || "New user added successfully.",
          response.data?.emailSent === false ? "error" : "success"
        );
      }

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm(emptyUserForm);
      await Promise.all([fetchUsers(), fetchCustomRoles()]);
    } catch (error) {
      console.error("User save failed:", error.response?.data || error);
      showToast(errMsg(error, "Failed to save user."), "error");
    } finally {
      setSavingUser(false);
    }
  };

  /* =========================================================
     DEPARTMENTS
  ========================================================= */

  const handleAddDepartment = async (event) => {
    event.preventDefault();

    const name = departmentForm.name.trim();
    const description = departmentForm.description.trim() || "Organization department";

    if (!name) {
      showToast("Department name is required.", "error");
      return;
    }

    if (departments.some((d) => d.name?.trim().toLowerCase() === name.toLowerCase())) {
      showToast("Department already exists.", "error");
      return;
    }

    try {
      await api.post("/departments", { name, description, status: "Active" });
      setDepartmentForm({ name: "", description: "" });
      setShowDepartmentModal(false);
      await fetchDepartments();
      showToast("Department created successfully.");
    } catch (error) {
      console.error("Department create failed:", error.response?.data || error);
      showToast(errMsg(error, "Failed to create department."), "error");
    }
  };

  const confirmDeleteDept = async () => {
    if (!deleteDept) return;
    const departmentId = deleteDept.id || deleteDept._id;
    if (!departmentId) {
      showToast("Department ID is missing.", "error");
      return;
    }

    try {
      await api.delete(`/departments/${departmentId}`);
      await fetchDepartments();
      setShowDeleteDeptModal(false);
      setDeleteDept(null);
      showToast("Department deleted successfully.");
    } catch (error) {
      console.error("Department delete failed:", error.response?.data || error);
      showToast(errMsg(error, "Failed to delete department."), "error");
    }
  };

  /* =========================================================
     DELETE USER
  ========================================================= */

  const confirmDelete = async () => {
    if (!deleteUser) return;
    try {
      await api.delete(`/users/${deleteUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setShowDeleteModal(false);
      setDeleteUser(null);
      showToast("User deleted successfully.");
      fetchCustomRoles();
    } catch (error) {
      console.error("User delete failed:", error.response?.data || error);
      showToast(errMsg(error, "Failed to delete user."), "error");
    }
  };

  /* =========================================================
     CSV
  ========================================================= */

  const downloadCSVTemplate = () => {
    const csv = [
      "Full Name,Email,Phone,Department,Role,Password",
      "John Doe,john@example.com,9876543210,Development,Team Member,ChangeMe#1",
      "Jane Smith,jane@example.com,9876543211,Marketing,Manager,ChangeMe#2",
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV template downloaded.");
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("Please upload a CSV file.", "error");
      return;
    }
    setSelectedFile(file);
  };

  // handles quoted values like "Doe, John"
  const splitCSVLine = (line) => {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = !quoted;
      } else if (ch === "," && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const parseCSV = (text) => {
    const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = splitCSVLine(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showToast("Please choose a CSV file first.", "error");
      return;
    }

    setImporting(true);
    try {
      const rows = parseCSV(await selectedFile.text());
      if (!rows.length) {
        showToast("The CSV file is empty.", "error");
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failures = [];

      for (const row of rows) {
        const email = row["Email"] || row.email || "row";
        const rowPassword = String(row["Password"] || row.password || "").trim();
        if (rowPassword.length < 6) {
          failCount += 1;
          failures.push(`${email}: Password missing or shorter than 6 characters`);
          continue;
        }

        try {
          await api.post("/users", {
            name: row["Full Name"] || row.name || "",
            email: row["Email"] || row.email || "",
            phone: row["Phone"] || row.phone || "",
            department: row["Department"] || row.department || "",
            password: rowPassword,
            role: toRoleValue(row["Role"] || row.role),
            ...(isSuperAdmin
              ? { adminId: row["Admin ID"] || organizations[0]?.id || "" }
              : {}),
          });
          successCount += 1;
        } catch (error) {
          failCount += 1;
          failures.push(`${email}: ${error.response?.data?.message || "failed"}`);
        }
      }

      await fetchUsers();

      if (failCount === 0) {
        showToast(`${successCount} users imported successfully.`);
      } else {
        console.warn("User import failures:", failures);
        showToast(`${successCount} imported, ${failCount} failed. ${failures[0] || ""}`, "error");
      }

      setSelectedFile(null);
      setShowBulkModal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      showToast("Failed to import users.", "error");
    } finally {
      setImporting(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="users-page">
      <style>{`
        * { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        button { cursor: pointer; }
        button:disabled { cursor: not-allowed; }

        :root {
          --ts-ink: #082032;
          --ts-border: rgba(8,126,164,.16);
          --ts-shadow: 0 22px 60px rgba(3,37,55,.12);
          --ts-radius: 24px;
        }

        /* PAGE — FIX: overflow-x only, so long content still scrolls */
        .users-page {
          min-height: 100vh;
          padding: 24px 4%;
          color: var(--ts-ink);
          position: relative;
          isolation: isolate;
          overflow-x: hidden;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at 8% 6%, rgba(34,211,238,.17), transparent 24%),
            radial-gradient(circle at 92% 14%, rgba(14,165,199,.13), transparent 25%),
            radial-gradient(circle at 50% 105%, rgba(103,232,249,.13), transparent 30%),
            linear-gradient(145deg, #effcff 0%, #f5fdff 45%, #e7f9fd 100%);
        }
        .users-page::before, .users-page::after {
          content: ""; position: absolute; z-index: -1; pointer-events: none;
          border-radius: 999px; filter: blur(3px); opacity: .72;
        }
        .users-page::before {
          width: 360px; height: 360px; right: -120px; top: 110px;
          background: radial-gradient(circle, rgba(34,211,238,.19), transparent 68%);
          animation: tsOrbFloat 12s ease-in-out infinite;
        }
        .users-page::after {
          width: 300px; height: 300px; left: -130px; bottom: 80px;
          background: radial-gradient(circle, rgba(8,126,164,.13), transparent 68%);
          animation: tsOrbFloat 15s ease-in-out infinite reverse;
        }
        .users-shell { width: min(1380px, 100%); margin: 0 auto; position: relative; z-index: 2; }

        /* HERO */
        .users-hero {
          position: relative; overflow: hidden; min-height: 158px; padding: 28px 30px;
          border-radius: 30px; border: 1px solid rgba(103,232,249,.24);
          background:
            radial-gradient(circle at 84% 10%, rgba(103,232,249,.20), transparent 26%),
            linear-gradient(135deg, #06263d 0%, #074b6a 54%, #087ea4 100%);
          box-shadow: 0 24px 70px rgba(3,50,72,.22);
          animation: heroEnter .65s ease both;
        }
        .users-hero::before {
          content: ""; position: absolute; inset: auto -8% -62%; height: 180px; border-radius: 50%;
          background: rgba(255,255,255,.08); transform: rotate(-3deg);
          animation: tsWaveDrift 8s ease-in-out infinite;
        }
        .users-hero::after {
          content: ""; position: absolute; width: 170px; height: 170px; right: 5%; top: -65px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 50%;
          box-shadow: 0 0 0 24px rgba(255,255,255,.035), 0 0 0 48px rgba(255,255,255,.025);
          animation: tsRingPulse 5s ease-in-out infinite;
        }
        .hero-content { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .hero-title-wrap { display: flex; align-items: center; gap: 18px; }
        .hero-icon {
          width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
          color: #075985; background: linear-gradient(145deg, #b9f4ff, #67e8f9);
          box-shadow: 0 10px 25px rgba(34,211,238,.22); animation: iconFloat 3.5s ease-in-out infinite;
        }
        .hero-title { margin: 0; color: #fff; font-size: 25px; line-height: 1.2; font-weight: 800; letter-spacing: -.5px; }
        .hero-subtitle { margin: 6px 0 0; color: rgba(231,248,255,.76); font-size: 12px; }
        .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .hero-btn {
          height: 38px; padding: 0 14px; display: inline-flex; align-items: center; gap: 7px; border-radius: 11px;
          border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.09); color: #fff;
          font-size: 11px; font-weight: 700; transition: transform .2s, background .2s, box-shadow .2s;
        }
        .hero-btn:hover { transform: translateY(-2px); background: rgba(255,255,255,.16); box-shadow: 0 9px 22px rgba(0,0,0,.12); }
        .hero-btn.primary { background: linear-gradient(135deg, #9eefff, #4dd9f2); color: #0b4666; border-color: rgba(255,255,255,.30); }
        .hero-btn.primary:hover { background: linear-gradient(135deg, #c3f7ff, #67e8f9); }
        .hero-mini-stats { position: relative; z-index: 2; display: flex; align-items: center; flex-wrap: wrap; gap: 25px; margin-top: 25px; }
        .hero-mini-stat { display: flex; align-items: center; gap: 7px; color: rgba(233,249,255,.78); font-size: 10px; }
        .hero-mini-stat svg { color: #8beeff; }
        .hero-mini-stat strong { color: #fff; margin-left: 2px; }

        /* SHARED CARD LOOK */
        .stat-card, .chart-card, .department-card, .user-card {
          position: relative; overflow: hidden; border: 1px solid var(--ts-border); border-radius: var(--ts-radius);
          background: linear-gradient(145deg, rgba(255,255,255,.92), rgba(239,252,255,.72));
          box-shadow: var(--ts-shadow); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s, border-color .35s;
        }
        .stat-card::before, .chart-card::before, .department-card::before, .user-card::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
          background: linear-gradient(90deg, #075985, #22d3ee, #087ea4); background-size: 220% 100%;
          animation: tsGradientFlow 4.5s linear infinite;
        }
        .stat-card:hover, .chart-card:hover, .department-card:hover, .user-card:hover {
          transform: translateY(-6px); border-color: rgba(14,165,199,.32); box-shadow: 0 28px 72px rgba(3,70,95,.17);
        }

        /* STATS */
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-top: 16px; }
        .stat-card { min-height: 112px; padding: 17px; animation: cardEnter .65s ease both; }
        .stat-card:nth-child(2) { animation-delay: .14s; }
        .stat-card:nth-child(3) { animation-delay: .20s; }
        .stat-card:nth-child(4) { animation-delay: .26s; }
        .stat-glow {
          position: absolute; width: 110px; height: 110px; border-radius: 50%; right: -38px; top: -45px;
          background: radial-gradient(circle, rgba(14,165,233,.14), transparent 68%);
        }
        .stat-icon {
          position: relative; width: 31px; height: 31px; display: grid; place-items: center; border-radius: 9px;
          border: 1px solid rgba(103,232,249,.35); background: linear-gradient(145deg, #063653, #087ea4);
          color: #dffcff; box-shadow: 0 12px 28px rgba(8,126,164,.22); animation: tsIconFloat 4s ease-in-out infinite;
        }
        .stat-icon::after {
          content: ""; position: absolute; inset: -8px; border: 1px solid rgba(34,211,238,.20); border-radius: inherit;
          animation: tsIconRipple 3s ease-out infinite;
        }
        .stat-label { margin-top: 11px; color: #64869a; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        .stat-value { margin-top: 4px; color: #102f49; font-size: 24px; line-height: 1; font-weight: 800; }
        .stat-meta { position: absolute; right: 15px; top: 20px; display: flex; align-items: center; gap: 3px; color: #0284c7; font-size: 8px; font-weight: 800; }

        /* ANALYTICS */
        .analytics-grid { display: grid; grid-template-columns: minmax(0,1.65fr) minmax(320px,.9fr); gap: 14px; margin-top: 16px; }
        .chart-card { animation: cardEnter .7s ease both; }
        .chart-card-header { padding: 17px 18px 10px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(42,120,150,.07); }
        .chart-title-wrap { display: flex; align-items: center; gap: 9px; }
        .chart-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 9px; color: #0284c7; background: #effaff; border: 1px solid #d5f1fa; }
        .chart-title { margin: 0; color: #183d5b; font-size: 11px; font-weight: 800; }
        .chart-subtitle { margin: 3px 0 0; color: #86a3b1; font-size: 8px; }
        .chart-total { text-align: right; }
        .chart-total strong { color: #0e3552; font-size: 17px; }
        .chart-total span { display: block; margin-top: 2px; color: #0284c7; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .chart-body { padding: 7px 13px 14px; }
        .activity-chart { width: 100%; height: 220px; display: block; overflow: visible; }
        .chart-grid-line { stroke: rgba(32,105,140,.10); stroke-width: 1; }
        /* FIX: gradient id now matches <linearGradient id="usersOceanArea"> */
        .chart-area { fill: url(#usersOceanArea); animation: tsAreaReveal 1.4s ease both; }
        .chart-line {
          fill: none; stroke: #087ea4; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
          filter: drop-shadow(0 5px 8px rgba(8,126,164,.18));
          stroke-dasharray: 900; stroke-dashoffset: 900; animation: tsChartDraw 1.8s cubic-bezier(.4,0,.2,1) forwards;
        }
        .chart-point { fill: #fff; stroke: #08a6d9; stroke-width: 3; }
        .chart-label { fill: #87a4b2; font-size: 8px; }

        .distribution-body { padding: 17px; }
        .distribution-list { display: flex; flex-direction: column; gap: 16px; }
        .distribution-row { display: flex; flex-direction: column; gap: 7px; }
        .distribution-top { display: flex; align-items: center; justify-content: space-between; color: #456b80; font-size: 8px; font-weight: 700; }
        .distribution-top strong { color: #143c59; font-size: 8px; }
        .distribution-track { height: 7px; overflow: hidden; border-radius: 999px; background: rgba(8,126,164,.09); }
        .distribution-fill {
          height: 100%; border-radius: 999px; background: linear-gradient(90deg, #075985, #0ea5c7, #67e8f9);
          background-size: 180% 100%; box-shadow: 0 2px 7px rgba(14,165,233,.20);
          transition: width .7s ease; animation: tsProgressFlow 3s linear infinite;
        }
        .empty-department { padding: 25px 12px; text-align: center; color: #88a4b1; font-size: 9px; }

        /* TABS */
        .tabs-wrap { margin-top: 16px; display: inline-flex; padding: 3px; border-radius: 12px; background: rgba(255,255,255,.86); border: 1px solid rgba(32,120,150,.10); box-shadow: 0 7px 18px rgba(24,83,108,.06); }
        .tab-btn { border: none; background: transparent; color: #7292a1; padding: 9px 16px; border-radius: 9px; display: flex; align-items: center; gap: 7px; font-size: 9px; font-weight: 800; transition: all .2s; }
        .tab-btn:hover { color: #155277; }
        .tab-btn.active { color: #fff; background: linear-gradient(135deg, #075985, #0e7490); box-shadow: 0 6px 15px rgba(7,89,133,.20); }
        .tab-count { min-width: 19px; height: 18px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: rgba(14,165,233,.10); color: #0284c7; font-size: 8px; }
        .tab-btn.active .tab-count { color: #075985; background: #dff8ff; }

        /* FILTERS */
        .filter-card { margin-top: 12px; padding: 13px; border-radius: 15px; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.94); border: 1px solid rgba(32,120,150,.10); box-shadow: 0 10px 24px rgba(25,86,112,.07); animation: cardEnter .65s ease both; }
        .search-box { flex: 1; height: 37px; position: relative; }
        .search-box svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #6f98aa; }
        .search-input { width: 100%; height: 100%; padding: 0 13px 0 35px; border-radius: 10px; border: 1px solid #dbeef4; outline: none; background: #f7fcfd; color: #173b59; font-size: 10px; }
        .search-input::placeholder { color: #91a9b5; }
        .filter-select { height: 37px; min-width: 145px; padding: 0 30px 0 11px; border-radius: 10px; border: 1px solid #dbeef4; outline: none; background: #f7fcfd; color: #365b71; font-size: 9px; font-weight: 600; }
        .clear-filter-btn { height: 37px; padding: 0 12px; border: 1px solid #d9edf4; border-radius: 10px; color: #36728d; background: #f8fcfd; display: flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; transition: all .2s; }
        .clear-filter-btn:hover { color: #075985; border-color: #9ddced; background: #edfaff; }

        .users-page input, .users-page select, .users-page textarea { transition: border-color .2s, box-shadow .2s, background .2s; }
        .users-page input:focus, .users-page select:focus, .users-page textarea:focus {
          outline: none; border-color: rgba(14,165,199,.55); background: #fff; box-shadow: 0 0 0 4px rgba(34,211,238,.10);
        }

        /* SECTION HEADER */
        .section-header { display: flex; align-items: center; justify-content: space-between; margin: 20px 2px 11px; }
        .section-title { display: flex; align-items: center; gap: 8px; color: #163d5a; font-size: 12px; font-weight: 800; }
        .section-title-icon { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #0284c7; background: #effaff; border: 1px solid #d8f2fa; }
        .result-count { color: #7595a4; font-size: 9px; }
        .add-dept-btn { height: 32px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 10px; background: linear-gradient(135deg, #075985, #0ea5e9); color: #fff; font-size: 9px; font-weight: 800; box-shadow: 0 7px 18px rgba(7,89,133,.22); transition: all .2s; }
        .add-dept-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(7,89,133,.28); }

        /* USER GRID */
        .users-grid, .department-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 13px; }
        .user-card { padding: 17px; min-height: 185px; animation: userCardEnter .55s ease both; }
        .user-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .user-avatar {
          position: relative; width: 42px; height: 42px; border-radius: 13px; display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 14px; font-weight: 800; background: linear-gradient(145deg, #063653, #0ea5c7);
          border: 2px solid rgba(255,255,255,.72); box-shadow: 0 12px 28px rgba(8,126,164,.22);
          animation: tsAvatarFloat 5s ease-in-out infinite;
        }
        .user-avatar::before { content: ""; position: absolute; inset: -5px; border-radius: inherit; border: 1px solid rgba(34,211,238,.28); animation: tsAvatarRing 3.5s ease-out infinite; }
        .user-card-actions { display: flex; align-items: center; gap: 6px; }
        .user-action-btn { width: 29px; height: 29px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #e0eef3; color: #7898a7; background: #f9fcfd; transition: all .2s; }
        .user-action-btn.edit:hover { color: #0284c7; border-color: #a7dceb; background: #edfaff; transform: translateY(-1px); }
        .user-action-btn.delete { color: #b45d5d; }
        .user-action-btn.delete:hover { color: #dc2626; border-color: #fecaca; background: #fef2f2; transform: translateY(-1px); box-shadow: 0 6px 14px rgba(220,38,38,.16); }
        .user-name { margin: 12px 0 2px; color: #143a57; font-size: 12px; font-weight: 800; }
        .user-role { color: #6f91a1; font-size: 8px; font-weight: 600; }
        .user-details { display: flex; flex-direction: column; gap: 7px; margin-top: 13px; padding-top: 11px; border-top: 1px solid #edf4f7; }
        .user-detail { display: flex; align-items: center; gap: 7px; color: #68899a; font-size: 8px; word-break: break-all; }
        .user-detail svg { color: #1689b7; flex-shrink: 0; }
        .user-card-footer { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; }
        .status-badge, .dept-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 999px; color: #075985; background: #eaf8fd; border: 1px solid #ccecf7; font-size: 7px; font-weight: 800; }
        .status-dot { width: 5px; height: 5px; border-radius: 50%; background: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,.10); }
        .role-badge { padding: 5px 8px; border-radius: 7px; color: #365d74; background: #f1f7fa; font-size: 7px; font-weight: 800; }

        /* EMPTY / LOADING */
        .empty-state {
          grid-column: 1 / -1; padding: 50px 20px; text-align: center; border-radius: 24px;
          border: 1px dashed rgba(8,126,164,.24);
          background: radial-gradient(circle at 50% 0%, rgba(34,211,238,.10), transparent 45%), rgba(255,255,255,.58);
        }
        .empty-icon { width: 52px; height: 52px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; border-radius: 16px; color: #087ea4; background: #edfaff; animation: tsEmptyFloat 3.5s ease-in-out infinite; }
        .empty-state h3 { margin: 0; color: #234a63; font-size: 13px; }
        .empty-state p { margin: 6px 0 0; color: #7898a6; font-size: 9px; }

        /* DEPARTMENT / ROLE CARDS */
        .department-card { padding: 18px; min-height: 170px; }
        .department-header { display: flex; align-items: center; gap: 11px; }
        .dept-icon-wrap { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #0284c7; background: linear-gradient(145deg, #effaff, #dcf3fb); border: 1px solid #d5f1fa; flex-shrink: 0; }
        .dept-info { min-width: 0; }
        .dept-name { margin: 0; color: #143a57; font-size: 12px; font-weight: 800; }
        .dept-desc { margin: 3px 0 0; color: #7d9dab; font-size: 8px; line-height: 1.5; }
        .dept-members-pill { margin-top: 14px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; color: #075985; background: #eaf8fd; border: 1px solid #ccecf7; font-size: 8px; font-weight: 800; }
        .dept-card-footer { margin-top: 14px; padding-top: 12px; border-top: 1px solid #edf4f7; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .dept-delete-btn { height: 28px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px; border-radius: 8px; border: 1px solid #fecaca; color: #dc2626; background: #fef2f2; font-size: 8px; font-weight: 800; transition: all .2s; }
        .dept-delete-btn:hover { background: #fee2e2; transform: translateY(-1px); box-shadow: 0 6px 14px rgba(220,38,38,.18); }
        .dept-edit-btn { border-color: #cdeff7; color: #0e7490; background: #effaff; }
        .dept-edit-btn:hover { background: #e0f6fd; box-shadow: 0 6px 14px rgba(14,116,144,.15); }

        /* MODALS */
        .modal-overlay {
          position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(2,25,39,.58); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          z-index: 100; animation: overlayIn .25s ease both;
        }
        .modal-card {
          width: min(520px, 100%); max-height: 90vh; overflow-y: auto; border-radius: 26px;
          background: radial-gradient(circle at 100% 0%, rgba(34,211,238,.10), transparent 30%), rgba(248,254,255,.97);
          border: 1px solid rgba(103,232,249,.22); box-shadow: 0 35px 100px rgba(1,25,40,.30);
          animation: modalEnter .4s cubic-bezier(.16,1,.3,1) both;
        }
        .modal-header { position: relative; padding: 20px 22px 14px; display: flex; align-items: flex-start; gap: 12px; border-bottom: 1px solid #eef6f9; }
        .modal-icon { width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; color: #0284c7; background: #effaff; border: 1px solid #d5f1fa; }
        .modal-header h3 { margin: 0; color: #143a57; font-size: 14px; font-weight: 800; }
        .modal-header p { margin: 4px 0 0; color: #7d9dab; font-size: 10px; }
        .modal-close { position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; border: 1px solid #e0eef3; color: #7898a7; background: #f9fcfd; transition: all .2s; }
        .modal-close:hover { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
        .modal-form { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field > span { display: flex; align-items: center; gap: 5px; color: #4a6f83; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
        .form-field input, .form-field select { height: 38px; padding: 0 12px; border-radius: 10px; border: 1px solid #dbeef4; outline: none; background: #f7fcfd; color: #173b59; font-size: 11px; }
        .form-field select:disabled { opacity: .65; }
        .form-field input::placeholder { color: #a5bec9; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #eef6f9; }
        .btn-secondary { height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid #d9edf4; color: #36728d; background: #f8fcfd; font-size: 11px; font-weight: 700; transition: all .2s; }
        .btn-secondary:hover { color: #075985; border-color: #9ddced; background: #edfaff; }
        .btn-primary { height: 38px; padding: 0 18px; display: inline-flex; align-items: center; gap: 7px; border-radius: 10px; border: 1px solid rgba(103,232,249,.28); background: linear-gradient(135deg, #063653, #087ea4); color: #fff; font-size: 11px; font-weight: 800; box-shadow: 0 12px 28px rgba(8,126,164,.22); transition: all .2s; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(8,126,164,.30); }
        .btn-primary:disabled { opacity: .5; }
        .btn-danger { height: 38px; padding: 0 18px; display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 10px; background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; font-size: 11px; font-weight: 800; box-shadow: 0 8px 20px rgba(220,38,38,.25); transition: all .2s; }
        .btn-danger:hover { transform: translateY(-2px); background: linear-gradient(135deg, #b91c1c, #dc2626); }

        .delete-modal { width: min(430px, 100%); padding: 26px 24px 22px; text-align: center; }
        .delete-icon-wrap { width: 56px; height: 56px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; border-radius: 18px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; animation: pulseDanger 2s ease-in-out infinite; }
        .delete-title { margin: 0; color: #16324a; font-size: 15px; font-weight: 800; }
        .delete-message { margin: 8px 0 0; color: #6b8b9b; font-size: 11px; line-height: 1.6; }
        .delete-message strong { color: #b91c1c; }
        .delete-user-preview { margin: 16px 0 4px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; text-align: left; border-radius: 12px; background: #f7fcfd; border: 1px solid #e2f1f7; }
        .preview-avatar { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 11px; color: #fff; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #075985, #0ea5e9); }
        .delete-user-preview strong { display: block; color: #143a57; font-size: 11px; }
        .delete-user-preview span { display: block; margin-top: 2px; color: #7d9dab; font-size: 9px; }
        .delete-modal .modal-actions { justify-content: center; margin-top: 16px; }

        .bulk-body { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
        .bulk-steps { display: flex; flex-direction: column; gap: 10px; }
        .bulk-step { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border-radius: 12px; color: #456b80; background: #f7fcfd; border: 1px solid #e2f1f7; font-size: 10px; }
        .bulk-step svg { color: #0284c7; flex-shrink: 0; }
        .bulk-template-btn { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; border: 1px solid #d9edf4; color: #36728d; background: #f8fcfd; font-size: 10px; font-weight: 700; }
        .bulk-template-btn:hover { color: #075985; border-color: #9ddced; background: #edfaff; }
        .bulk-upload { display: block; padding: 22px; text-align: center; cursor: pointer; border: 2px dashed #b9dce8; border-radius: 14px; background: #f7fcfd; transition: all .2s; }
        .bulk-upload:hover { border-color: #55bce0; background: #edfaff; }
        .bulk-upload-icon { width: 44px; height: 44px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; border-radius: 13px; color: #0284c7; background: #effaff; border: 1px solid #d5f1fa; }
        .bulk-upload h4 { margin: 0; color: #143a57; font-size: 11px; font-weight: 800; }
        .bulk-upload p { margin: 4px 0 0; color: #7d9dab; font-size: 9px; }
        .file-chip { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; color: #0e7490; background: #effaff; border: 1px solid #d5f1fa; font-size: 10px; font-weight: 700; }
        .file-chip button { margin-left: auto; display: flex; border: none; background: transparent; color: #7898a7; }
        .file-chip button:hover { color: #dc2626; }

        /* TOAST */
        .toast {
          position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 200; max-width: min(560px, 92vw);
          display: flex; align-items: center; gap: 9px; padding: 12px 18px; border-radius: 12px; font-size: 11px; font-weight: 700;
          color: #fff; border: 1px solid rgba(255,255,255,.2); box-shadow: 0 18px 45px rgba(3,55,76,.28);
          animation: toastIn .3s ease both;
        }
        .toast.success { background: linear-gradient(135deg, #063653, #087ea4); }
        .toast.error { background: linear-gradient(135deg, #b91c1c, #ef4444); }

        /* KEYFRAMES */
        @keyframes heroEnter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes cardEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes userCardEnter { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes iconFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalEnter { from { opacity: 0; transform: translateY(24px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 14px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes pulseDanger { 0%,100% { box-shadow: 0 10px 24px rgba(220,38,38,.16); } 50% { box-shadow: 0 10px 30px rgba(220,38,38,.30); } }
        @keyframes tsOrbFloat { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-24px,18px,0) scale(1.08); } }
        @keyframes tsWaveDrift { 0%,100% { transform: translateX(-2%) rotate(-3deg); } 50% { transform: translateX(4%) rotate(1deg); } }
        @keyframes tsRingPulse { 0%,100% { transform: scale(.92); opacity: .55; } 50% { transform: scale(1.06); opacity: .9; } }
        @keyframes tsGradientFlow { 0% { background-position: 0% 50%; } 100% { background-position: 220% 50%; } }
        @keyframes tsIconFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes tsIconRipple { 0% { transform: scale(.82); opacity: .65; } 80%,100% { transform: scale(1.35); opacity: 0; } }
        @keyframes tsAvatarFloat { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(1deg); } }
        @keyframes tsAvatarRing { 0% { transform: scale(.92); opacity: .65; } 100% { transform: scale(1.24); opacity: 0; } }
        @keyframes tsProgressFlow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes tsChartDraw { to { stroke-dashoffset: 0; } }
        @keyframes tsAreaReveal { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tsEmptyFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

        /* RESPONSIVE */
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .analytics-grid { grid-template-columns: 1fr; }
          .users-grid, .department-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 640px) {
          .users-page { padding: 12px; }
          .users-grid, .department-grid, .form-row-2 { grid-template-columns: 1fr; }
          .hero-content { flex-direction: column; align-items: flex-start; }
          .filter-card { flex-wrap: wrap; }
          .filter-select { flex: 1; min-width: 0; }
          .tabs-wrap { display: flex; overflow-x: auto; max-width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .users-page *, .users-page *::before, .users-page *::after {
            animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important;
          }
          .chart-line { stroke-dashoffset: 0; }
        }
      `}</style>

      <div className="users-shell">
        {/* ================= HERO ================= */}
        <section className="users-hero">
          <div className="hero-content">
            <div className="hero-title-wrap">
              <div className="hero-icon">
                <Users size={24} />
              </div>
              <div>
                <h1 className="hero-title">Users &amp; Departments</h1>
                <p className="hero-subtitle">
                  Manage your team members, roles and organizational departments.
                </p>
              </div>
            </div>

            {canCreateUsers && (
              <div className="hero-actions">
                <button type="button" className="hero-btn" onClick={() => setShowBulkModal(true)}>
                  <Upload size={13} /> Import CSV
                </button>
                <button type="button" className="hero-btn" onClick={() => setShowDepartmentModal(true)}>
                  <Building2 size={13} /> Add Department
                </button>
                <button type="button" className="hero-btn primary" onClick={openAddUser}>
                  <UserPlus size={13} /> Add User
                </button>
              </div>
            )}
          </div>

          <div className="hero-mini-stats">
            <div className="hero-mini-stat"><Activity size={12} /> Total Users <strong>{totalUsers}</strong></div>
            <div className="hero-mini-stat"><ShieldCheck size={12} /> Admins <strong>{totalAdmins}</strong></div>
            <div className="hero-mini-stat"><UserRoundCog size={12} /> Managers <strong>{totalManagers}</strong></div>
            <div className="hero-mini-stat"><Building2 size={12} /> Departments <strong>{totalDepartments}</strong></div>
            <div className="hero-mini-stat"><CalendarDays size={12} /> Active <strong>{activeUsers}</strong></div>
          </div>
        </section>

        {/* ================= STATS ================= */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-glow" />
            <div className="stat-icon"><Users size={15} /></div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{totalUsers}</div>
            <div className="stat-meta"><TrendingUp size={9} /> {activeUsers} active</div>
          </div>

          <div className="stat-card" onClick={() => setActiveTab("departments")} style={{ cursor: "pointer" }}>
            <span className="stat-glow" />
            <div className="stat-icon"><Building2 size={15} /></div>
            <div className="stat-label">Departments</div>
            <div className="stat-value">{totalDepartments}</div>
            <div className="stat-meta"><ArrowUpRight size={9} /> View</div>
          </div>

          <div className="stat-card">
            <span className="stat-glow" />
            <div className="stat-icon"><ShieldCheck size={15} /></div>
            <div className="stat-label">Admins</div>
            <div className="stat-value">{totalAdmins}</div>
          </div>

          <div className="stat-card">
            <span className="stat-glow" />
            <div className="stat-icon"><UserRoundCog size={15} /></div>
            <div className="stat-label">Managers</div>
            <div className="stat-value">{totalManagers}</div>
          </div>
        </div>

        {/* ================= ANALYTICS ================= */}
        <div className="analytics-grid">
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <div className="chart-icon"><BarChart3 size={15} /></div>
                <div>
                  <h3 className="chart-title">User Activity Trend</h3>
                  <p className="chart-subtitle">Last 6 months overview</p>
                </div>
              </div>
              <div className="chart-total">
                <strong>{totalUsers}</strong>
                <span>Total</span>
              </div>
            </div>

            <div className="chart-body">
              <svg className="activity-chart" viewBox={`0 0 ${chartW} ${chartH}`}>
                <defs>
                  <linearGradient id="usersOceanArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(14, 165, 233, 0.28)" />
                    <stop offset="100%" stopColor="rgba(14, 165, 233, 0.02)" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75].map((ratio) => (
                  <line
                    key={ratio}
                    className="chart-grid-line"
                    x1={14}
                    x2={chartW - 14}
                    y1={16 + ratio * (chartH - 40)}
                    y2={16 + ratio * (chartH - 40)}
                  />
                ))}

                <path className="chart-area" d={areaPath} />
                <path key={totalUsers} className="chart-line" d={linePath} />

                {chartPoints.map((point, index) => (
                  <circle key={index} className="chart-point" cx={point.x} cy={point.y} r={4.5} />
                ))}

                {MONTHS.map((month, index) => (
                  <text key={month} className="chart-label" x={chartPoints[index]?.x} y={chartH - 4} textAnchor="middle">
                    {month}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-title-wrap">
                <div className="chart-icon"><Waves size={15} /></div>
                <div>
                  <h3 className="chart-title">Department Distribution</h3>
                  <p className="chart-subtitle">Users per department</p>
                </div>
              </div>
            </div>

            <div className="distribution-body">
              <div className="distribution-list">
                {departmentStats.length === 0 ? (
                  <div className="empty-department">No departments yet.</div>
                ) : (
                  departmentStats.map((dept) => (
                    <div className="distribution-row" key={dept.id}>
                      <div className="distribution-top">
                        <strong>{dept.name}</strong>
                        <span>{dept.count} users</span>
                      </div>
                      <div className="distribution-track">
                        <div
                          className="distribution-fill"
                          style={{ width: `${(dept.count / maxDepartmentCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= TABS ================= */}
        <div className="tabs-wrap">
          <button type="button" className={activeTab === "users" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab("users")}>
            <Users size={13} /> Users <span className="tab-count">{totalUsers}</span>
          </button>
          <button type="button" className={activeTab === "departments" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab("departments")}>
            <Building2 size={13} /> Departments <span className="tab-count">{totalDepartments}</span>
          </button>
          <button type="button" className={activeTab === "roles" ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab("roles")}>
            <UserRoundCog size={13} /> Roles <span className="tab-count">{customRoles.length}</span>
          </button>
        </div>

        {/* ================= FILTERS ================= */}
        {activeTab === "users" && (
          <div className="filter-card">
            <div className="search-box">
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Search users by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select className="filter-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="All Departments">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>

            <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="All Roles">All Roles</option>
              {isSuperAdmin && <option value="Admin">Admin</option>}
              <option value="Manager">Manager</option>
              <option value="User">Team Member</option>
              {customRoles.map((r) => (
                <option key={r._id} value={`custom:${r._id}`}>{r.name}</option>
              ))}
            </select>

            <button type="button" className="clear-filter-btn" onClick={clearFilters}>
              <X size={12} /> Clear
            </button>
          </div>
        )}

        {/* ================= SECTION HEADER ================= */}
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">
              {activeTab === "users" ? (
                <UserRound size={13} />
              ) : activeTab === "roles" ? (
                <UserRoundCog size={13} />
              ) : (
                <Building size={13} />
              )}
            </span>
            {activeTab === "users" ? "Team Members" : activeTab === "roles" ? "Roles" : "Departments"}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="result-count">
              {loading
                ? "Loading…"
                : activeTab === "users"
                ? `${filteredUsers.length} of ${totalUsers} users`
                : activeTab === "roles"
                ? `${customRoles.length} organization roles`
                : `${totalDepartments} departments`}
            </span>

            {activeTab === "roles" && canAssignRoles && (
              <button type="button" className="add-dept-btn" onClick={() => openRoleModal()}>
                <Plus size={12} /> Add Role
              </button>
            )}

            {activeTab === "departments" && canCreateUsers && (
              <button type="button" className="add-dept-btn" onClick={() => setShowDepartmentModal(true)}>
                <Plus size={12} /> Add Department
              </button>
            )}
          </div>
        </div>

        {/* ================= PASSWORD RESET REQUESTS ================= */}
        {activeTab === "users" && canEditUsers && resetRequests.length > 0 && (
          <div style={{ margin: "0 0 16px", padding: 14, borderRadius: 16, background: "#FFFBF0", border: "1px solid #F3DDA9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13, color: "#8a5a00", marginBottom: 10 }}>
              <LockKeyhole size={14} />
              {resetRequests.length} password reset request{resetRequests.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resetRequests.map((request) => {
                const reqUserId = idOf(request.user);
                const target = users.find((u) => String(u.id) === String(reqUserId));
                return (
                  <div
                    key={request._id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
                      gap: 8, padding: "9px 12px", borderRadius: 12, background: "#fff", border: "1px solid #F1E6CC", fontSize: 12,
                    }}
                  >
                    <span>
                      <strong>{request.user?.name || target?.name || "User"}</strong> (
                      {request.user?.email || target?.email || "—"}) · {roleLabel(request.user?.role || target?.role)}
                      {request.requestedAt ? ` · requested ${new Date(request.requestedAt).toLocaleString()}` : ""}
                    </span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!target}
                        title={target ? undefined : "Account not in your list"}
                        onClick={() => target && openEditUser(target)}
                        style={{ height: 30, padding: "0 12px", fontSize: 11 }}
                      >
                        Set new password
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => dismissResetRequest(request)}
                        style={{ height: 30, padding: "0 12px", fontSize: 11 }}
                      >
                        Dismiss
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= USERS GRID ================= */}
        {activeTab === "users" && (
          <div className="users-grid">
            {loading ? (
              <div className="empty-state">
                <div className="empty-icon"><Users size={22} /></div>
                <h3>Loading users…</h3>
                <p>The server may take a few seconds to wake up.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><UserX size={22} /></div>
                <h3>No users found</h3>
                <p>Try adjusting your search or filters, or add a new team member.</p>
              </div>
            ) : (
              filteredUsers.map((user, index) => (
                <div className="user-card" key={user.id || index} style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}>
                  <div className="user-card-top">
                    <div className="user-avatar">{user.avatar}</div>
                    <div className="user-card-actions">
                      {canEditUsers && (
                        <button type="button" className="user-action-btn edit" title="Edit user" onClick={() => openEditUser(user)}>
                          <Pencil size={13} />
                        </button>
                      )}
                      {canDeleteUsers && (
                        <button type="button" className="user-action-btn delete" title="Delete user" onClick={() => openDeleteUser(user)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="user-name">{user.name}</h3>
                  <span className="user-role">
                    {user.customRoleName || roleLabel(user.role)}
                    {isSuperAdmin && user.organization ? ` · ${user.organization}` : ""}
                  </span>

                  <div className="user-details">
                    <div className="user-detail"><Mail size={11} />{user.email || "No email"}</div>
                    <div className="user-detail"><Phone size={11} />{user.phone || "No phone"}</div>
                    <div className="user-detail"><BriefcaseBusiness size={11} />{user.department || "No department"}</div>
                  </div>

                  {!user.emailVerified && (
                    <div
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        margin: "8px 0 4px", padding: "6px 9px", borderRadius: 9, background: "#FFF7E6",
                        border: "1px solid #F3DDA9", color: "#9a6a0a", fontSize: 10, fontWeight: 700,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Mail size={11} /> Email not verified
                      </span>
                      {canEditUsers && (
                        <button
                          type="button"
                          onClick={() => resendVerification(user)}
                          disabled={resendingId === user.id}
                          style={{ border: "none", background: "transparent", color: "#0b8f87", fontSize: 10, fontWeight: 800 }}
                        >
                          {resendingId === user.id ? "Sending…" : "Resend link"}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="user-card-footer">
                    <span className="status-badge"><span className="status-dot" />{user.status}</span>
                    <span className="role-badge">{user.customRoleName || roleLabel(user.role)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= ROLES GRID ================= */}
        {activeTab === "roles" && (
          <div className="department-grid">
            {customRoles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><UserRoundCog size={22} /></div>
                <h3>No custom roles yet</h3>
                <p>
                  Add roles such as “Consultant” or “Team Lead”. Each role uses the Manager or Team Member
                  access level, and its permissions can be fine-tuned on the Roles &amp; Permissions page.
                </p>
              </div>
            ) : (
              customRoles.map((r) => {
                const baseLabel = r.baseRoleLabel || roleLabel(r.baseRole);
                return (
                  <div className="department-card" key={r._id}>
                    <div className="department-header">
                      <div className="dept-icon-wrap"><UserRoundCog size={17} /></div>
                      <div className="dept-info">
                        <h3 className="dept-name">{r.name}</h3>
                        <p className="dept-desc">{r.description || `${baseLabel} access level`}</p>
                      </div>
                    </div>

                    <div className="dept-members-pill">
                      <Users size={11} />
                      {r.users ?? 0} {r.users === 1 ? "Member" : "Members"}
                    </div>

                    <div className="dept-card-footer">
                      <span className="dept-status-badge">
                        <span className="status-dot" />
                        {baseLabel} access{r.hasOwnPermissions ? " · own permissions" : ""}
                      </span>
                      {canAssignRoles && (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="dept-delete-btn dept-edit-btn" onClick={() => openRoleModal(r)}>
                            <Pencil size={11} /> Edit
                          </button>
                          <button type="button" className="dept-delete-btn" onClick={() => deleteRole(r)}>
                            <Trash2 size={11} /> Delete
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= DEPARTMENTS GRID ================= */}
        {activeTab === "departments" && (
          <div className="department-grid">
            {departments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Building2 size={22} /></div>
                <h3>No departments yet</h3>
                <p>Create your first department to start organizing users.</p>
              </div>
            ) : (
              departmentStats.map((dept, index) => (
                <div className="department-card" key={dept.id || index}>
                  <div className="department-header">
                    <div className="dept-icon-wrap"><Building2 size={17} /></div>
                    <div className="dept-info">
                      <h3 className="dept-name">{dept.name}</h3>
                      <p className="dept-desc">{dept.description}</p>
                    </div>
                  </div>

                  <div className="dept-members-pill">
                    <Users size={11} />
                    {dept.count} {dept.count === 1 ? "Member" : "Members"}
                  </div>

                  <div className="dept-card-footer">
                    <span className="dept-status-badge"><span className="status-dot" />{dept.status || "Active"}</span>
                    {canDeleteUsers && (
                      <button type="button" className="dept-delete-btn" onClick={() => openDeleteDept(dept)}>
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= ADD / EDIT USER MODAL ================= */}
        {showUserModal && (
          <div className="modal-overlay" onClick={() => !savingUser && setShowUserModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon">{editingUser ? <Pencil size={18} /> : <UserPlus size={18} />}</div>
                <div>
                  <h3>{editingUser ? "Edit User" : "Add New User"}</h3>
                  <p>{editingUser ? "Update the user's details below." : "Fill in the details to create a new user."}</p>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowUserModal(false)}>
                  <X size={14} />
                </button>
              </div>

              <form className="modal-form" onSubmit={handleSaveUser}>
                <div className="form-row-2">
                  <label className="form-field">
                    <span>Full Name *</span>
                    <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g. John Doe" />
                  </label>
                  <label className="form-field">
                    <span>Email *</span>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="john@company.com" />
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Phone *</span>
                    <input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="9876543210" />
                  </label>
                  <label className="form-field">
                    <span>
                      <LockKeyhole size={10} /> {editingUser ? "Set new password" : "Password *"}
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={editingUser ? "Leave empty to keep the current password" : "Min 6 characters"}
                    />
                    <small style={{ fontSize: 10, color: "#6b8a94", marginTop: 4 }}>
                      {editingUser
                        ? "The user gets an email link to view the new password once (30 seconds)."
                        : "The user verifies their email, then sees this password once for 30 seconds."}
                    </small>
                  </label>
                </div>

                <div className="form-row-2">
                  <label className="form-field">
                    <span>Department *</span>
                    <select value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}>
                      <option value="">Select department</option>
                      {/* keep a department the user already has even if it was removed from the list */}
                      {userForm.department && !departments.some((d) => d.name === userForm.department) && (
                        <option value={userForm.department}>{userForm.department}</option>
                      )}
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Role *</span>
                    <select
                      value={userForm.role}
                      disabled={Boolean(editingUser) && (!canAssignRoles || editingUser.role === "Admin")}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    >
                      {!assignableRoles.some((o) => o.value === userForm.role) && !userForm.role.startsWith("custom:") && (
                        <option value={userForm.role}>{roleLabel(userForm.role)}</option>
                      )}
                      {assignableRoles
                        .filter((o) => !editingUser || (o.value === "Admin") === (editingUser.role === "Admin"))
                        .map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      {editingUser?.role !== "Admin" &&
                        rolesForOrg(editingUser ? editingUser.adminId : userForm.adminId).length > 0 && (
                          <optgroup label="Organization roles">
                            {rolesForOrg(editingUser ? editingUser.adminId : userForm.adminId).map((r) => (
                              <option key={r._id} value={`custom:${r._id}`}>
                                {r.name} ({r.baseRoleLabel || roleLabel(r.baseRole)} access)
                              </option>
                            ))}
                          </optgroup>
                        )}
                    </select>
                  </label>
                </div>

                {isSuperAdmin && !editingUser && userForm.role !== "Admin" && (
                  <label className="form-field">
                    <span>Organization (Admin) *</span>
                    <select value={userForm.adminId} onChange={(e) => setUserForm({ ...userForm, adminId: e.target.value })}>
                      <option value="">Select organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={savingUser}>
                    {savingUser ? "Saving…" : editingUser ? "Save Changes" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= DELETE USER MODAL ================= */}
        {showDeleteModal && deleteUser && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-card delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="delete-icon-wrap"><Trash2 size={24} /></div>
              <h3 className="delete-title">Delete User</h3>
              <p className="delete-message">
                Are you sure you want to permanently delete <strong>"{deleteUser.name}"</strong>? This action cannot be undone.
              </p>
              <div className="delete-user-preview">
                <div className="preview-avatar">{deleteUser.avatar}</div>
                <div>
                  <strong>{deleteUser.name}</strong>
                  <span>{deleteUser.email}</span>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button type="button" className="btn-danger" onClick={confirmDelete}>
                  <Trash2 size={13} /> Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE DEPARTMENT MODAL ================= */}
        {showDeleteDeptModal && deleteDept && (
          <div className="modal-overlay" onClick={() => setShowDeleteDeptModal(false)}>
            <div className="modal-card delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="delete-icon-wrap"><Trash2 size={24} /></div>
              <h3 className="delete-title">Delete Department</h3>
              <p className="delete-message">
                Are you sure you want to permanently delete <strong>"{deleteDept.name}"</strong>?
                {deptMemberCount > 0 && ` ${deptMemberCount} user(s) currently belong to this department.`} This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDeleteDeptModal(false)}>Cancel</button>
                <button type="button" className="btn-danger" onClick={confirmDeleteDept}>
                  <Trash2 size={13} /> Yes, Delete Department
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD / EDIT ROLE MODAL ================= */}
        {showRoleModal && (
          <div className="modal-overlay" onClick={() => !savingRole && setShowRoleModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon"><UserRoundCog size={18} /></div>
                <div>
                  <h3>{editingRole ? "Edit Role" : "Add New Role"}</h3>
                  <p>Roles appear in the role list when you add or edit users.</p>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowRoleModal(false)}>
                  <X size={14} />
                </button>
              </div>

              <form className="modal-form" onSubmit={saveRole}>
                {isSuperAdmin && !editingRole && (
                  <label className="form-field">
                    <span>Organization (Admin) *</span>
                    <select value={roleForm.adminId} onChange={(e) => setRoleForm({ ...roleForm, adminId: e.target.value })}>
                      <option value="">Select organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="form-field">
                  <span>Role Name *</span>
                  <input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="e.g. Consultant" maxLength={60} />
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Short description (optional)" maxLength={300} />
                </label>
                <label className="form-field">
                  <span>Access level *</span>
                  <select value={roleForm.baseRole} onChange={(e) => setRoleForm({ ...roleForm, baseRole: e.target.value })}>
                    <option value="User">Team Member — works on own tasks</option>
                    <option value="Manager">Manager — manages the team's tasks</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowRoleModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={savingRole}>
                    {editingRole ? <Pencil size={13} /> : <Plus size={13} />}{" "}
                    {savingRole ? "Saving…" : editingRole ? "Save Role" : "Create Role"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= ADD DEPARTMENT MODAL ================= */}
        {showDepartmentModal && (
          <div className="modal-overlay" onClick={() => setShowDepartmentModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon"><Building2 size={18} /></div>
                <div>
                  <h3>Add New Department</h3>
                  <p>Create a department to organize your users.</p>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowDepartmentModal(false)}>
                  <X size={14} />
                </button>
              </div>

              <form className="modal-form" onSubmit={handleAddDepartment}>
                <label className="form-field">
                  <span>Department Name *</span>
                  <input value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="e.g. Finance" />
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <input value={departmentForm.description} onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })} placeholder="Short description (optional)" />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowDepartmentModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">
                    <Plus size={13} /> Create Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= BULK IMPORT MODAL ================= */}
        {showBulkModal && (
          <div className="modal-overlay" onClick={() => !importing && setShowBulkModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon"><FileSpreadsheet size={18} /></div>
                <div>
                  <h3>Import Users from CSV</h3>
                  <p>Upload a CSV file to add multiple users at once.</p>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowBulkModal(false)}>
                  <X size={14} />
                </button>
              </div>

              <div className="bulk-body">
                <div className="bulk-steps">
                  <div className="bulk-step"><Download size={14} /> Step 1: Download the CSV template.</div>
                  <div className="bulk-step"><FileSpreadsheet size={14} /> Step 2: Fill in user details in the template.</div>
                  <div className="bulk-step"><Upload size={14} /> Step 3: Upload the completed CSV file.</div>
                </div>

                <button type="button" className="bulk-template-btn" onClick={downloadCSVTemplate}>
                  <Download size={13} /> Download CSV Template
                </button>

                <label className="bulk-upload">
                  <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleFileChange} />
                  <div className="bulk-upload-icon"><Upload size={18} /></div>
                  <h4>Click to select a CSV file</h4>
                  <p>Only .csv files are supported</p>
                </label>

                {selectedFile && (
                  <div className="file-chip">
                    <FileSpreadsheet size={14} />
                    {selectedFile.name}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={handleImport} disabled={!selectedFile || importing}>
                    <Upload size={13} /> {importing ? "Importing…" : "Import Users"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TOAST ================= */}
        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
