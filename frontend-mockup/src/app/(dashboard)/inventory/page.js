"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingDown,
  X,
  PackageX,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const statusConfig = {
  ok: {
    label: "In Stock",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40",
    rowTint: "",
  },
  low: {
    label: "Low Stock",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/50",
    rowTint: "bg-amber-500/5",
  },
  out: {
    label: "Out of Stock",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40",
    rowTint: "bg-rose-500/5",
  },
};

const emptyItem = {
  branch_id: "",
  name: "",
  currentStock: "",
  unit: "kg",
  safetyStockLevel: "",
  reorderDelayDays: "",
  costPerUnit: "",
  shelfLifeDays: "",
};

function mapInventoryItem(item) {
  return {
    ...item,
    currentStock: Number(item.current_stock),
    safetyStockLevel: Number(item.safety_stock_level),
    reorderDelayDays: item.reorder_delay_days,
    costPerUnit: Number(item.cost_per_unit),
    shelfLifeDays: item.shelf_life_days,
  };
}

export default function InventoryPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyItem);
  const [editingItemId, setEditingItemId] = useState(null);

  // XGBoost Reorder Prediction State
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderAlerts, setReorderAlerts] = useState([]);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  const [reorderFilter, setReorderFilter] = useState("critical"); // 'critical', 'warning', 'all'
  const [copiedChecklist, setCopiedChecklist] = useState(false);

  useEffect(() => {
    apiRequest("/api/branches", {}, session)
      .then((loaded) => {
        setBranches(loaded);
        if (loaded[0]) setSelectedBranchId(loaded[0].id);
      })
      .catch(() => setBranches([]));

    apiRequest("/api/inventory-items", {}, session)
      .then((loaded) => setItems(loaded.map(mapInventoryItem)))
      .catch(() => setItems([]));
  }, [session]);

  // Stat calculations
  const totalItems = items.length;
  const lowStockCount = items.filter((i) => i.status === "low").length;
  const outOfStockCount = items.filter((i) => i.status === "out").length;
  const atRiskCount = items.filter((i) => i.status === "low").length;

  // Filtered & sorted inventory items
  const visibleItems = useMemo(() => {
    let result = selectedBranchId ? items.filter((i) => i.branch_id === selectedBranchId) : items;
    if (searchQuery.trim()) {
      result = result.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    const statusOrder = { out: 0, low: 1, ok: 2 };
    return [...result].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [items, selectedBranchId, searchQuery]);

  // Fetch ML Forecasts from backend
  async function fetchReorderAlerts(branchId = selectedBranchId) {
    if (!branchId) return;
    setIsLoadingForecast(true);
    setForecastError(null);
    try {
      const data = await apiRequest(`/api/inventory/reorder-alerts?branch_id=${branchId}&horizon_days=30`, {}, session);
      setReorderAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setForecastError(err.message || "Failed to load ML forecast recommendations.");
    } finally {
      setIsLoadingForecast(false);
    }
  }

  function handleOpenReorderModal() {
    setIsReorderModalOpen(true);
    fetchReorderAlerts(selectedBranchId || branches[0]?.id);
  }

  const criticalOrders = useMemo(() => {
    return reorderAlerts.filter(
      (a) => a.urgency === "critical" || (a.days_until_safety_breach !== null && a.days_until_safety_breach <= 2)
    );
  }, [reorderAlerts]);

  const warningOrders = useMemo(() => {
    return reorderAlerts.filter((a) => a.urgency === "warning");
  }, [reorderAlerts]);

  const filteredReorderAlerts = useMemo(() => {
    if (reorderFilter === "critical") return criticalOrders;
    if (reorderFilter === "warning") return [...criticalOrders, ...warningOrders];
    return reorderAlerts;
  }, [reorderAlerts, reorderFilter, criticalOrders, warningOrders]);

  function copyChecklistToClipboard() {
    if (!filteredReorderAlerts.length) return;
    const branchName = branches.find((b) => b.id === selectedBranchId)?.address || "Main Kitchen";
    const lines = [
      `🛒 *Rasoi Sathi — Purchase Order Checklist*`,
      `Branch: ${branchName}`,
      `Generated on: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      `----------------------------------------`,
      ...filteredReorderAlerts.map((a, idx) => {
        const qty = a.recommended_order_qty > 0 ? `${a.recommended_order_qty} ${a.unit}` : `Review Stock`;
        const dateNote = a.order_by_date ? ` (Order by: ${a.order_by_date})` : "";
        return `${idx + 1}. [ ] *${a.ingredient_name}*: Order *+${qty}*${dateNote} [Current: ${a.current_stock} ${a.unit}]`;
      }),
      `----------------------------------------`,
      `Powered by Rasoi Sathi XGBoost Intelligence`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2500);
  }

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveItem() {
    const payload = {
      branch_id: formData.branch_id,
      name: formData.name,
      unit: formData.unit,
      current_stock: Number(formData.currentStock) || 0,
      safety_stock_level: Number(formData.safetyStockLevel) || 0,
      reorder_delay_days: Number(formData.reorderDelayDays) || 0,
      cost_per_unit: Number(formData.costPerUnit) || 0,
      shelf_life_days: formData.shelfLifeDays ? Number(formData.shelfLifeDays) : null,
    };
    const created = await apiRequest(
      editingItemId ? `/api/inventory-items/${editingItemId}` : "/api/inventory-items",
      { method: editingItemId ? "PATCH" : "POST", body: JSON.stringify(payload) },
      session
    );
    const mapped = mapInventoryItem(created);
    setItems((prev) =>
      editingItemId ? prev.map((item) => (item.id === editingItemId ? mapped : item)) : [...prev, mapped]
    );
    setFormData(emptyItem);
    setEditingItemId(null);
    setIsModalOpen(false);
  }

  function openAddModal() {
    setEditingItemId(null);
    setFormData({ ...emptyItem, branch_id: selectedBranchId || branches[0]?.id || "" });
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItemId(item.id);
    setFormData({
      branch_id: item.branch_id,
      name: item.name,
      currentStock: item.currentStock,
      unit: item.unit,
      safetyStockLevel: item.safetyStockLevel,
      reorderDelayDays: item.reorderDelayDays,
      costPerUnit: item.costPerUnit,
      shelfLifeDays: item.shelfLifeDays || "",
    });
    setIsModalOpen(true);
  }

  async function handleDeleteItem(id) {
    if (!window.confirm("Delete this inventory item and its recipe link?")) return;
    await apiRequest(`/api/inventory-items/${id}`, { method: "DELETE" }, session);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink tracking-tight">Inventory Intelligence</h1>
            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Live Sync
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            Real-time stock monitoring with XGBoost machine learning consumption forecasting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* What to Buy for Tomorrow High-Contrast AI Button */}
          <button
            onClick={handleOpenReorderModal}
            className="flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg active:scale-98 transition group border border-slate-700 dark:border-amber-300"
          >
            <Sparkles size={17} className="text-amber-400 dark:text-slate-950 group-hover:rotate-12 transition-transform" />
            <span>What to Buy for Tomorrow</span>
            {criticalOrders.length > 0 && (
              <span className="bg-rose-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                {criticalOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-surface hover:bg-surface-2 border border-border text-ink font-medium px-4 py-2.5 rounded-xl transition shadow-xs"
          >
            <Plus size={17} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
          <div className="bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <Package className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-bold text-ink mt-1">{totalItems}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
          <div className="bg-amber-500/15 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <AlertTriangle className="text-amber-700 dark:text-amber-400" size={20} />
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Low Stock</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{lowStockCount}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
          <div className="bg-rose-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <PackageX className="text-rose-600 dark:text-rose-400" size={20} />
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Out of Stock</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{outOfStockCount}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
          <div className="bg-indigo-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <TrendingDown className="text-indigo-600 dark:text-indigo-400" size={20} />
          </div>
          <p className="text-xs font-medium text-muted uppercase tracking-wider">At Risk This Week</p>
          <p className="text-2xl font-bold text-ink mt-1">{atRiskCount}</p>
        </div>
      </div>

      {/* Search + Branch Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400 transition"
          />
        </div>
        <select
          value={selectedBranchId}
          onChange={(e) => {
            setSelectedBranchId(e.target.value);
            if (isReorderModalOpen) fetchReorderAlerts(e.target.value);
          }}
          className="bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink font-medium outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400 transition"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.address || "Branch Outlet"}
            </option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-surface-2 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-muted">
              <Package size={28} />
            </div>
            <p className="font-semibold text-ink">No inventory items found</p>
            <p className="text-muted text-xs mt-1">Add items to this branch to start tracking.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                <th className="px-5 py-3.5">Ingredient Name</th>
                <th className="px-5 py-3.5">Current Stock Level</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Lead Time</th>
                <th className="px-5 py-3.5">Unit Cost</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleItems.map((item) => {
                const config = statusConfig[item.status] || statusConfig.ok;
                const fillPct =
                  item.safetyStockLevel > 0
                    ? Math.min(100, Math.round((item.currentStock / item.safetyStockLevel) * 100))
                    : 100;

                return (
                  <tr key={item.id} className={`hover:bg-surface-2/40 transition-colors ${config.rowTint}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Safety threshold: {item.safetyStockLevel} {item.unit}
                      </p>
                    </td>
                    <td className="px-5 py-4 w-52">
                      <p className="text-ink font-medium text-xs mb-1.5 flex justify-between">
                        <span>
                          <strong>{item.currentStock}</strong> {item.unit}
                        </span>
                        <span className="text-muted">Target: {item.safetyStockLevel} {item.unit}</span>
                      </p>
                      <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-border/50">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === "out"
                              ? "bg-rose-500"
                              : item.status === "low"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink font-medium text-xs">
                      {item.reorderDelayDays} days
                    </td>
                    <td className="px-5 py-4 text-ink font-medium text-xs">
                      ₹{item.costPerUnit} <span className="text-muted font-normal">/{item.unit}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface-2 transition"
                          title="Edit ingredient"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-muted hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                          title="Delete ingredient"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* High-Contrast "What to Buy for Tomorrow" Reorder Modal */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-start justify-between bg-surface-2/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950 flex items-center justify-center shadow-md font-bold">
                  <Sparkles size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-ink">Tomorrow's Restock & Purchase List</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                      XGBoost ML
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    AI calculations based on 90-day recipe sales, lead times, shelf life, and recursive burn rate.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchReorderAlerts()}
                  className="p-2 text-muted hover:text-ink hover:bg-surface rounded-xl transition border border-transparent hover:border-border"
                  title="Refresh ML Projections"
                >
                  <RefreshCw size={17} className={isLoadingForecast ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setIsReorderModalOpen(false)}
                  className="p-2 text-muted hover:text-ink hover:bg-surface rounded-xl transition border border-transparent hover:border-border"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Action Bar */}
            <div className="px-6 py-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReorderFilter("critical")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    reorderFilter === "critical"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-surface-2 text-muted hover:text-ink hover:bg-surface-3"
                  }`}
                >
                  <span>🚨 Urgent (Tomorrow)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${reorderFilter === "critical" ? "bg-black/30 text-white" : "bg-border text-muted"}`}>
                    {criticalOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setReorderFilter("warning")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    reorderFilter === "warning"
                      ? "bg-amber-400 text-slate-950 shadow-xs"
                      : "bg-surface-2 text-muted hover:text-ink hover:bg-surface-3"
                  }`}
                >
                  <span>⚠️ Next 7 Days</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${reorderFilter === "warning" ? "bg-slate-950/20 text-slate-950" : "bg-border text-muted"}`}>
                    {criticalOrders.length + warningOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setReorderFilter("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    reorderFilter === "all"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "bg-surface-2 text-muted hover:text-ink hover:bg-surface-3"
                  }`}
                >
                  All Items ({reorderAlerts.length})
                </button>
              </div>

              {filteredReorderAlerts.length > 0 && (
                <button
                  onClick={copyChecklistToClipboard}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-surface-2 dark:hover:bg-surface-3 dark:text-ink border border-slate-700 dark:border-border rounded-xl text-xs font-semibold transition shadow-xs"
                >
                  {copiedChecklist ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Vendor Checklist</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingForecast ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw size={32} className="animate-spin text-slate-900 dark:text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-ink">Running XGBoost Machine Learning Forecast...</p>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Computing daily burn rates, lag features, and par-level replenishment quantities.
                  </p>
                </div>
              ) : forecastError ? (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm">
                  <p className="font-bold mb-1">Could not generate forecast</p>
                  <p className="text-xs">{forecastError}</p>
                </div>
              ) : filteredReorderAlerts.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <CheckCircle2 size={44} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-base font-bold text-ink">No Urgent Reorders Required!</p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    All ingredient stock levels are comfortably above safety thresholds for the selected time horizon.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReorderAlerts.map((alert) => {
                    const isCritical =
                      alert.urgency === "critical" ||
                      (alert.days_until_safety_breach !== null && alert.days_until_safety_breach <= 2);
                    const isWarning = alert.urgency === "warning";

                    return (
                      <div
                        key={alert.id || alert.ingredient_name}
                        className={`p-4.5 rounded-2xl border transition-all ${
                          isCritical
                            ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60 shadow-xs"
                            : isWarning
                            ? "bg-amber-500/5 border-amber-400/40 hover:border-amber-400/70 shadow-xs"
                            : "bg-surface-2/40 border-border hover:border-border/80"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-ink text-base">{alert.ingredient_name}</h3>
                              {alert.category_code && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted font-mono font-bold">
                                  {alert.category_code}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                              Current Stock: <strong className="text-ink">{alert.current_stock} {alert.unit}</strong> (Safety: {alert.safety_stock} {alert.unit})
                            </p>
                          </div>

                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                              isCritical
                                ? "bg-rose-600 text-white shadow-xs"
                                : isWarning
                                ? "bg-amber-400 text-slate-950 font-bold shadow-xs"
                                : "bg-emerald-600 text-white font-bold"
                            }`}
                          >
                            {isCritical ? "Order Now" : isWarning ? "Order Soon" : "OK"}
                          </span>
                        </div>

                        {/* ML Prediction Metric Strip */}
                        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-surface border border-border text-xs mb-3 shadow-2xs">
                          <div>
                            <span className="text-muted block text-[10px] uppercase font-semibold">Daily Burn</span>
                            <span className="font-bold text-ink text-xs mt-0.5 block">
                              {alert.avg_daily_usage !== null ? `~${alert.avg_daily_usage} ${alert.unit}/d` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block text-[10px] uppercase font-semibold">Stock Runway</span>
                            <span className={`font-bold text-xs mt-0.5 block ${isCritical ? "text-rose-600 dark:text-rose-400" : "text-ink"}`}>
                              {alert.days_until_safety_breach !== null
                                ? `${alert.days_until_safety_breach}d left`
                                : "30d+ covered"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block text-[10px] uppercase font-semibold">Lead Time</span>
                            <span className="font-bold text-ink text-xs mt-0.5 block">{alert.reorder_delay_days}d delay</span>
                          </div>
                        </div>

                        {/* Order Suggestion Action Row */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                          <div className="flex items-center gap-1.5 text-muted">
                            <Calendar size={13} className="text-ink" />
                            <span>Deadline: <strong className="text-ink">{alert.order_by_date || "Today"}</strong></span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-muted font-medium">Restock:</span>
                            <span className="bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold px-2.5 py-0.5 rounded-lg text-xs shadow-xs">
                              +{alert.recommended_order_qty} {alert.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface flex items-center justify-between text-xs text-muted">
              <span>Projections automatically refresh with new kitchen sales.</span>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border text-ink font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">{editingItemId ? "Edit Inventory Item" : "Add Stock Item"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block uppercase">Branch</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => handleFormChange("branch_id", e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.address || "Branch"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block uppercase">Ingredient Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  placeholder="e.g. Basmati Rice, Chicken, Cooking Oil"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Current Stock</label>
                  <input
                    type="number"
                    value={formData.currentStock}
                    onChange={(e) => handleFormChange("currentStock", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => handleFormChange("unit", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Safety Stock</label>
                  <input
                    type="number"
                    value={formData.safetyStockLevel}
                    onChange={(e) => handleFormChange("safetyStockLevel", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Reorder Lead (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderDelayDays}
                    onChange={(e) => handleFormChange("reorderDelayDays", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Cost / Unit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => handleFormChange("costPerUnit", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block uppercase">Shelf Life (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.shelfLifeDays}
                    onChange={(e) => handleFormChange("shelfLifeDays", e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-xl hover:bg-surface-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 font-bold py-2.5 rounded-xl transition shadow-xs"
              >
                {editingItemId ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}