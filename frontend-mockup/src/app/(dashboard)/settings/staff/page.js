"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";
import { supabase } from "@/lib/supabase";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ChefHat,
  UtensilsCrossed,
  Crown,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  X,
} from "lucide-react";

const roleConfig = {
  owner: {
    label: "Owner",
    icon: <Crown size={14} className="text-amber-500" />,
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    desc: "Full workspace access (Dashboard, Analytics, Inventory, Copilot, Settings).",
  },
  chef: {
    label: "Chef",
    icon: <ChefHat size={14} className="text-blue-500" />,
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    desc: "Kitchen access only (Live Orders screen & Menu recipes).",
  },
  waiter: {
    label: "Waiter",
    icon: <UtensilsCrossed size={14} className="text-emerald-500" />,
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    desc: "Floor access only (Waiter Orders terminal for punching tickets).",
  },
};

export default function StaffManagementPage() {
  const { session, applicationUser } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "waiter",
    password: "Staff@" + Math.floor(1000 + Math.random() * 9000),
  });

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/staff", {}, session);
      setStaffList(data);
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to load staff list." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) loadStaff();
  }, [session]);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let pass = "Staff@";
    for (let i = 0; i < 4; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((prev) => ({ ...prev, password: pass }));
  }

  async function handleCreateStaff(e) {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: "", text: "" });

    try {
      let createdAuthUserId = null;

      // 1. If Supabase is active, register their auth credentials
      if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });

        if (authError && !authError.message.toLowerCase().includes("already registered")) {
          throw authError;
        }
        createdAuthUserId = authData?.user?.id || null;
      }

      // 2. Link staff member in backend database
      await apiRequest(
        "/api/staff",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: createdAuthUserId,
            name: form.name,
            email: form.email,
            role: form.role,
          }),
        },
        session
      );

      setFeedback({
        type: "success",
        text: `Staff member "${form.name}" created as ${form.role.toUpperCase()}. Password: ${form.password}`,
      });

      setIsModalOpen(false);
      setForm({
        name: "",
        email: "",
        role: "waiter",
        password: "Staff@" + Math.floor(1000 + Math.random() * 9000),
      });
      loadStaff();
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to create staff member." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(staff) {
    try {
      const updated = await apiRequest(
        `/api/staff/${staff.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !staff.is_active }),
        },
        session
      );
      setStaffList((current) =>
        current.map((item) => (item.id === staff.id ? { ...item, is_active: updated.is_active } : item))
      );
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Could not update status." });
    }
  }

  async function handleDelete(staffId) {
    if (!window.confirm("Are you sure you want to remove this staff member?")) return;
    try {
      await apiRequest(`/api/staff/${staffId}`, { method: "DELETE" }, session);
      setStaffList((current) => current.filter((item) => item.id !== staffId));
      setFeedback({ type: "success", text: "Staff member removed." });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Could not remove staff member." });
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredStaff =
    filter === "all"
      ? staffList
      : staffList.filter((s) => s.role.toLowerCase() === filter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink tracking-tight">
            Staff & Roles Management
          </h1>
          <p className="text-sm text-muted mt-1">
            Create logins for Chefs and Waiters with strict role-locked permissions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-md transition"
        >
          <UserPlus size={16} />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback({ type: "", text: "" })}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {["all", "owner", "chef", "waiter"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
              filter === tab
                ? "bg-surface-2 text-ink border border-border"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab === "all" ? "All Roles" : tab + "s"}
            <span className="ml-1.5 text-[10px] opacity-70">
              ({tab === "all" ? staffList.length : staffList.filter((s) => s.role.toLowerCase() === tab).length})
            </span>
          </button>
        ))}
      </div>

      {/* Staff Members Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted">Loading staff directory...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">No staff members found for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border text-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Staff Member</th>
                  <th className="px-5 py-3">Role & Access</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaff.map((staff) => {
                  const roleInfo = roleConfig[staff.role.toLowerCase()] || roleConfig.waiter;
                  const isCurrentOwner = staff.id === applicationUser?.id;

                  return (
                    <tr key={staff.id} className="hover:bg-surface-2/30 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-ink text-sm flex items-center gap-2">
                          {staff.name}
                          {isCurrentOwner && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-extrabold border border-amber-500/20">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-muted text-xs font-mono mt-0.5">{staff.email}</p>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${roleInfo.badge}`}
                        >
                          {roleInfo.icon}
                          <span>{roleInfo.label}</span>
                        </span>
                        <p className="text-[10px] text-muted mt-1 max-w-xs line-clamp-1">{roleInfo.desc}</p>
                      </td>

                      <td className="px-5 py-3.5">
                        <button
                          disabled={isCurrentOwner}
                          onClick={() => handleToggleStatus(staff)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                            staff.is_active
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          } ${isCurrentOwner ? "opacity-60 cursor-not-allowed" : "hover:opacity-80"}`}
                        >
                          {staff.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          <span>{staff.is_active ? "Active" : "Inactive"}</span>
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyToClipboard(staff.email, staff.id)}
                            title="Copy email"
                            className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface border border-border text-muted hover:text-ink transition"
                          >
                            {copiedId === staff.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>

                          {!isCurrentOwner && (
                            <button
                              onClick={() => handleDelete(staff.id)}
                              title="Delete staff member"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Access Matrix Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <h3 className="font-display font-bold text-base text-ink mb-3">Role Permissions Matrix</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(roleConfig).map(([key, item]) => (
            <div key={key} className="p-4 rounded-xl bg-surface-2/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                {item.icon}
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider">{item.label}</h4>
              </div>
              <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Staff Member */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-ink">Add Staff Member</h3>
                <p className="text-xs text-muted">Create login credentials for your team member.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  required
                  placeholder="e.g. Rohan Patil"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Login Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="e.g. rohan@saffronjunction.demo"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Assigned Role
                </label>
                <select
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent font-bold"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="waiter">🛎️ Waiter (Floor Orders Terminal only)</option>
                  <option value="chef">🍳 Chef (Kitchen Orders & Menu only)</option>
                  <option value="owner">👑 Owner (Full Workspace Access)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider">
                    Temporary Password / PIN
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <KeyRound size={12} />
                    <span>Regenerate</span>
                  </button>
                </div>
                <input
                  required
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs font-mono font-bold text-ink outline-none focus:border-accent"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-[10px] text-muted mt-1">
                  Share this password with your staff member for logging in.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 font-extrabold text-xs shadow-sm hover:from-orange-600 disabled:opacity-50"
                >
                  {saving ? "Creating staff member..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
