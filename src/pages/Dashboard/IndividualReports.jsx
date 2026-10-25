import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, RefreshCw, Download, Loader2, AlertTriangle, ChevronRight, X, Award, Clock3 } from "lucide-react";
import API from "../../api/config";

/* =========================================================
   Individual reports — one row per person (assigned, completed,
   pending, in progress, overdue, completion & on-time rate).
   Data: GET /api/reports/individual (organization-scoped).
========================================================= */

const DATE_RANGES = ["All time", "Today", "Last 7 days", "Last 30 days", "This month", "Last month", "This year"];

const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

const IndividualReports = () => {
  const [filters, setFilters] = useState({ dateRange: "All time", department: "All Departments", role: "All Roles", userId: "" });
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(null); // person detail
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { ...filters };
      if (!params.userId) delete params.userId;
      const res = await API.get("/api/reports/individual", { params });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load individual reports.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // filter options from the backend
  useEffect(() => {
    API.get("/api/departments").then((r) => setDepartments((r.data.data || []).map((d) => d.name))).catch(() => {});
    API.get("/api/custom-roles").then((r) => setRoles(r.data.data || [])).catch(() => {});
  }, []);

  const openPerson = async (person) => {
    setSelected(person);
    setDetail(null);
    try {
      const params = { ...filters, userId: person.userId };
      const res = await API.get("/api/reports/individual", { params });
      setDetail(res.data.data.tasks || []);
    } catch {
      setDetail([]);
    }
  };

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.people || []).filter((p) => !q || `${p.name} ${p.email} ${p.department} ${p.roleLabel}`.toLowerCase().includes(q));
  }, [data, search]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Department", "Role", "Assigned", "Completed", "In progress", "Pending", "Review", "Overdue", "Completion %", "On-time %", "Avg completion (h)", "Points"];
    const lines = people.map((p) =>
      [p.name, p.email, p.department, p.roleLabel, p.assigned, p.completed, p.inProgress, p.pending, p.review, p.overdue, p.completionRate, p.onTimeRate ?? "", p.avgCompletionHours ?? "", p.pointsEarned]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `individual-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const totals = data?.totals;

  return (
    <div className="individual-reports">
      <section className="configuration-card ir-filters">
        <div className="ir-filter-grid">
          <label>
            <span>Date range</span>
            <select value={filters.dateRange} onChange={set("dateRange")}>
              {DATE_RANGES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <span>Department</span>
            <select value={filters.department} onChange={set("department")}>
              <option>All Departments</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select value={filters.role} onChange={set("role")}>
              <option>All Roles</option>
              <option value="Manager">Manager</option>
              <option value="User">Team Member</option>
              {roles.map((r) => <option key={r._id} value={`custom:${r._id}`}>{r.name}</option>)}
            </select>
          </label>
          <label>
            <span>Person</span>
            <select value={filters.userId} onChange={set("userId")}>
              <option value="">Everyone</option>
              {(data?.people || []).map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
            </select>
          </label>
          <label className="ir-search">
            <span>Search</span>
            <div>
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, department…" />
            </div>
          </label>
          <div className="ir-actions">
            <button type="button" className="ir-btn" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? "ir-spin" : ""} />
            </button>
            <button type="button" className="ir-btn primary" onClick={exportCsv} disabled={!people.length}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </section>

      {totals && (
        <section className="ir-kpis">
          {[
            ["People", totals.people],
            ["Assigned", totals.assigned],
            ["Completed", `${totals.completed} (${totals.completionRate}%)`],
            ["In progress", totals.inProgress],
            ["Pending", totals.pending],
            ["Overdue", totals.overdue],
          ].map(([label, value]) => (
            <div className="ir-kpi" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
      )}

      <section className="table-card ir-table-card">
        <div className="ir-table-head">
          <h3><Users size={16} /> Individual performance</h3>
          <span>{people.length} {people.length === 1 ? "person" : "people"}</span>
        </div>

        {error ? (
          <div className="ir-state error"><AlertTriangle size={16} /> {error}</div>
        ) : loading && !data ? (
          <div className="ir-state"><Loader2 size={16} className="ir-spin" /> Loading…</div>
        ) : !people.length ? (
          <div className="ir-state">No people match these filters.</div>
        ) : (
          <div className="ir-table-wrap">
            <table className="ir-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>In progress</th>
                  <th>Pending</th>
                  <th>Overdue</th>
                  <th>Completion</th>
                  <th>On time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} onClick={() => openPerson(p)}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>{p.department || "No department"}</small>
                    </td>
                    <td>{p.roleLabel}</td>
                    <td>{p.assigned}</td>
                    <td className="good">{p.completed}</td>
                    <td>{p.inProgress}</td>
                    <td>{p.pending}</td>
                    <td className={p.overdue ? "bad" : ""}>{p.overdue}</td>
                    <td>
                      <div className="ir-bar"><span style={{ width: `${p.completionRate}%` }} /></div>
                      <small>{p.completionRate}%</small>
                    </td>
                    <td>{pct(p.onTimeRate)}</td>
                    <td><ChevronRight size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="ir-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <aside className="ir-drawer" role="dialog" aria-label={`Report for ${selected.name}`}>
            <div className="ir-drawer-head">
              <div>
                <h3>{selected.name}</h3>
                <p>{[selected.roleLabel, selected.department, selected.email].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" className="ir-btn" onClick={() => setSelected(null)} aria-label="Close"><X size={15} /></button>
            </div>
            <div className="ir-kpis small">
              {[
                ["Assigned", selected.assigned],
                ["Completed", selected.completed],
                ["In progress", selected.inProgress],
                ["Pending", selected.pending],
                ["Review", selected.review],
                ["Overdue", selected.overdue],
              ].map(([label, value]) => (
                <div className="ir-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
            <div className="ir-facts">
              <span><Award size={14} /> {selected.pointsEarned} points earned</span>
              <span><Clock3 size={14} /> {selected.avgCompletionHours !== null ? `${selected.avgCompletionHours} h average to complete` : "No completed tasks yet"}</span>
              <span>On-time completion: <strong>{pct(selected.onTimeRate)}</strong></span>
            </div>
            <h4>Tasks in this period</h4>
            {!detail ? (
              <div className="ir-state"><Loader2 size={14} className="ir-spin" /> Loading tasks…</div>
            ) : !detail.length ? (
              <div className="ir-state">No tasks in this period.</div>
            ) : (
              <div className="ir-task-list">
                {detail.map((t) => (
                  <div key={t._id} className="ir-task">
                    <span className={`ir-status s-${String(t.status).replace(/\s/g, "").toLowerCase()}`}>{t.status}</span>
                    <span className="ir-task-name">{t.name}</span>
                    <small>{t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : "No due date"}</small>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      <style>{`
        .individual-reports { display: flex; flex-direction: column; gap: 16px; }
        .ir-filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end; }
        .ir-filter-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; font-weight: 700; color: #4f6f7a; text-transform: uppercase; letter-spacing: .4px; }
        .ir-filter-grid select, .ir-search > div { height: 40px; border: 1px solid #d6e8ec; border-radius: 11px; background: #fff; padding: 0 10px; font-size: 13px; color: #082f3a; font-weight: 500; text-transform: none; letter-spacing: 0; }
        .ir-search > div { display: flex; align-items: center; gap: 6px; color: #7b969e; }
        .ir-search input { border: none; outline: none; flex: 1; min-width: 0; font-size: 13px; background: transparent; color: #082f3a; }
        .ir-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .ir-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 12px; border-radius: 11px; border: 1px solid #d6e8ec; background: #fff; color: #0e7490; font-weight: 700; font-size: 13px; cursor: pointer; }
        .ir-btn.primary { background: linear-gradient(135deg, #123b5d, #16a6b8); color: #fff; border: none; }
        .ir-btn:disabled { opacity: .55; cursor: not-allowed; }
        .ir-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
        .ir-kpi { background: rgba(255,255,255,.92); border: 1px solid #d6e8ec; border-radius: 15px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 8px 28px rgba(23,50,77,.045); }
        .ir-kpi span { font-size: 11px; font-weight: 700; color: #7b969e; text-transform: uppercase; letter-spacing: .5px; }
        .ir-kpi strong { font-size: 22px; color: #082f3a; }
        .ir-kpis.small .ir-kpi { padding: 10px 12px; }
        .ir-kpis.small .ir-kpi strong { font-size: 18px; }
        .ir-table-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid #e6f0f2; }
        .ir-table-head h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; color: #082f3a; }
        .ir-table-head span { font-size: 12px; color: #7b969e; }
        .ir-table-wrap { overflow-x: auto; }
        .ir-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ir-table th { text-align: left; padding: 11px 14px; font-size: 11px; color: #608894; text-transform: uppercase; letter-spacing: .5px; background: #f6fbfc; }
        .ir-table td { padding: 11px 14px; border-top: 1px solid #eef5f6; color: #123b5d; vertical-align: middle; }
        .ir-table tbody tr { cursor: pointer; transition: .15s; }
        .ir-table tbody tr:hover { background: #f4fbfc; }
        .ir-table td small { display: block; color: #7b969e; font-size: 11px; margin-top: 2px; }
        .ir-table td.good { color: #17724a; font-weight: 700; }
        .ir-table td.bad { color: #a83c55; font-weight: 700; }
        .ir-bar { width: 90px; height: 6px; border-radius: 99px; background: #e6f0f2; overflow: hidden; }
        .ir-bar span { display: block; height: 100%; background: linear-gradient(90deg, #16a6b8, #0ea5a0); }
        .ir-state { display: flex; align-items: center; gap: 8px; padding: 22px 18px; color: #6e8799; font-size: 13px; }
        .ir-state.error { color: #a83c55; }
        .ir-spin { animation: irSpin 1s linear infinite; }
        @keyframes irSpin { to { transform: rotate(360deg); } }
        .ir-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(6,59,70,.35); display: flex; justify-content: flex-end; }
        .ir-drawer { width: min(460px, 100%); height: 100%; overflow-y: auto; background: #fff; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: -20px 0 50px rgba(6,59,70,.2); }
        .ir-drawer-head { display: flex; justify-content: space-between; gap: 10px; }
        .ir-drawer-head h3 { margin: 0; color: #082f3a; }
        .ir-drawer-head p { margin: 4px 0 0; font-size: 12px; color: #6e8799; }
        .ir-drawer h4 { margin: 4px 0 0; font-size: 13px; color: #082f3a; }
        .ir-facts { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #123b5d; background: #f4fbfc; border: 1px solid #e3eef2; border-radius: 12px; padding: 12px; }
        .ir-facts span { display: flex; align-items: center; gap: 7px; }
        .ir-task-list { display: flex; flex-direction: column; gap: 6px; }
        .ir-task { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: center; border: 1px solid #e3eef2; border-radius: 11px; padding: 8px 10px; font-size: 13px; }
        .ir-task small { grid-column: 2; color: #7b969e; font-size: 11px; }
        .ir-task-name { color: #123b5d; font-weight: 600; }
        .ir-status { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px; background: #eef7fa; color: #2f6f91; }
        .ir-status.s-completed { background: #eaf8f1; color: #17724a; }
        .ir-status.s-inprogress { background: #fff7e6; color: #b7791f; }
        .ir-status.s-review { background: #f1eefc; color: #6b4fc8; }
      `}</style>
    </div>
  );
};

export default IndividualReports;
