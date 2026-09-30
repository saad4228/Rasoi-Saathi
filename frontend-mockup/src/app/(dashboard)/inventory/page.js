"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  IndianRupee,
  Package,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import NoOutletNotice from "@/components/dashboard/NoOutletNotice";
import { useOutlets } from "@/context/OutletContext";
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

const UNITS = ["kg", "g", "litre", "ml", "pcs"];
const emptyItem = { name: "", currentStock: "", unit: "kg", safetyStockLevel: "", reorderDelayDays: "", costPerUnit: "", shelfLifeDays: "" };
const inputClass = "w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400";

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
  const { activeOutletId, activeOutlet } = useOutlets();
  const [stock, setStock] = useState({ outletId: null, items: [], error: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyItem);
  const [editingItemId, setEditingItemId] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [movement, setMovement] = useState(null); // { item, type: "PURCHASE" | "WASTE", quantity, unitCost, error, saving }

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [forecast, setForecast] = useState({ outletId: null, alerts: [], error: "", loading: false });
  const [reorderFilter, setReorderFilter] = useState("critical");
  const [copiedChecklist, setCopiedChecklist] = useState(false);

  useEffect(() => {
    if (!activeOutletId) return undefined;
    let cancelled = false;
    apiRequest(`/api/inventory-items?branch_id=${activeOutletId}`)
      .then((items) => {
        if (!cancelled) setStock({ outletId: activeOutletId, items: items.map(mapInventoryItem), error: "" });
      })
      .catch((error) => {
        if (!cancelled) setStock({ outletId: activeOutletId, items: [], error: error.message || "Unable to load inventory." });
      });
    return () => {
      cancelled = true;
    };
  }, [activeOutletId]);

  const items = useMemo(() => (stock.outletId === activeOutletId ? stock.items : []), [stock, activeOutletId]);
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const statusOrder = { out: 0, low: 1, ok: 2 };
    return items.filter((item) => !query || item.name.toLowerCase().includes(query)).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [items, searchQuery]);

  const alerts = forecast.outletId === activeOutletId ? forecast.alerts : [];
  const criticalOrders = alerts.filter((a) => a.urgency === "critical");
  const warningOrders = alerts.filter((a) => a.urgency === "warning");
  const filteredReorderAlerts =
    reorderFilter === "critical" ? criticalOrders : reorderFilter === "warning" ? [...criticalOrders, ...warningOrders] : alerts;

  if (!activeOutletId) return <NoOutletNotice />;

  const loaded = stock.outletId === activeOutletId;
  const lowStockCount = items.filter((i) => i.status === "low").length;
  const outOfStockCount = items.filter((i) => i.status === "out").length;
  const stockValue = items.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0);

  async function fetchReorderAlerts() {
    const outletId = activeOutletId;
    setForecast({ outletId, alerts: [], error: "", loading: true });
    try {
      const data = await apiRequest(`/api/inventory/reorder-alerts?branch_id=${outletId}&horizon_days=30`);
      setForecast({ outletId, alerts: Array.isArray(data) ? data : [], error: "", loading: false });
    } catch (err) {
      setForecast({ outletId, alerts: [], error: err.message || "Failed to load reorder recommendations.", loading: false });
    }
  }

  function handleOpenReorderModal() {
    setIsReorderModalOpen(true);
    fetchReorderAlerts();
  }

  function copyChecklistToClipboard() {
    if (!filteredReorderAlerts.length) return;
    const lines = [
      `🛒 *Rasoi Saathi — Purchase Checklist*`,
      `Outlet: ${activeOutlet?.address || "—"}`,
      `Generated on: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      `----------------------------------------`,
      ...filteredReorderAlerts.map((a, idx) => {
        const qty = a.recommended_order_qty > 0 ? `${a.recommended_order_qty} ${a.unit}` : "Review stock";
        const dateNote = a.order_by_date ? ` (order by ${a.order_by_date})` : "";
        return `${idx + 1}. [ ] *${a.ingredient_name}*: +${qty}${dateNote} [now ${a.current_stock} ${a.unit}]`;
      }),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2500);
  }

  function openAddModal() {
    setEditingItemId(null);
    setFormData(emptyItem);
    setFormError("");
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItemId(item.id);
    setFormData({
      name: item.name,
      currentStock: String(item.currentStock),
      unit: item.unit,
      safetyStockLevel: String(item.safetyStockLevel),
      reorderDelayDays: String(item.reorderDelayDays ?? 0),
      costPerUnit: String(item.costPerUnit),
      shelfLifeDays: item.shelfLifeDays ? String(item.shelfLifeDays) : "",
    });
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleSaveItem(event) {
    event.preventDefault();
    if (!formData.name.trim()) return setFormError("Enter the ingredient name.");
    if (formData.costPerUnit === "" || Number(formData.costPerUnit) < 0) return setFormError("Enter the cost per unit.");
    const numbers = [formData.currentStock, formData.safetyStockLevel, formData.reorderDelayDays, formData.shelfLifeDays];
    if (numbers.some((value) => value !== "" && (Number.isNaN(Number(value)) || Number(value) < 0))) {
      return setFormError("Stock levels and days can't be negative.");
    }

    const payload = {
      name: formData.name.trim(),
      unit: formData.unit,
      current_stock: Number(formData.currentStock || 0),
      safety_stock_level: Number(formData.safetyStockLevel || 0),
      reorder_delay_days: Math.round(Number(formData.reorderDelayDays || 0)),
      cost_per_unit: Number(formData.costPerUnit),
      shelf_life_days: formData.shelfLifeDays ? Math.round(Number(formData.shelfLifeDays)) : null,
    };
    setSaving(true);
    setFormError("");
    try {
      const saved = await apiRequest(editingItemId ? `/api/inventory-items/${editingItemId}` : "/api/inventory-items", {
        method: editingItemId ? "PATCH" : "POST",
        body: JSON.stringify(editingItemId ? payload : { ...payload, branch_id: activeOutletId }),
      });
      const mapped = mapInventoryItem(saved);
      setStock((previous) => ({
        ...previous,
        items: editingItemId ? previous.items.map((item) => (item.id === editingItemId ? mapped : item)) : [...previous.items, mapped],
      }));
      setIsModalOpen(false);
    } catch (error) {
      setFormError(error.message || "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function openMovement(item, type) {
    setMovement({ item, type, quantity: "", unitCost: type === "PURCHASE" ? String(item.costPerUnit) : "", error: "", saving: false });
  }

  async function saveMovement(event) {
    event.preventDefault();
    const quantity = Number(movement.quantity);
    if (!(quantity > 0)) return setMovement({ ...movement, error: "Enter a quantity greater than zero." });
    const payload = { type: movement.type, quantity };
    if (movement.type === "PURCHASE" && movement.unitCost !== "") payload.unit_cost = Number(movement.unitCost);
    setMovement({ ...movement, saving: true, error: "" });
    try {
      const saved = mapInventoryItem(
        await apiRequest(`/api/inventory-items/${movement.item.id}/movements`, { method: "POST", body: JSON.stringify(payload) })
      );
      setStock((previous) => ({ ...previous, items: previous.items.map((item) => (item.id === saved.id ? saved : item)) }));
      setMovement(null);
    } catch (error) {
      setMovement((current) => current && { ...current, saving: false, error: error.message || "The stock change could not be saved." });
    }
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Remove "${item.name}" from this outlet? It is taken out of recipes; items with stock history are archived so past reports stay intact.`)) return;
    setPageError("");
    try {
      await apiRequest(`/api/inventory-items/${item.id}`, { method: "DELETE" });
      setStock((previous) => ({ ...previous, items: previous.items.filter((existing) => existing.id !== item.id) }));
    } catch (error) {
      setPageError(error.message || "The item could not be deleted.");
    }
  }

  const statCards = [
    { label: "Stock items", value: items.length, icon: Package, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { label: "Low stock", value: lowStockCount, icon: AlertTriangle, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    { label: "Out of stock", value: outOfStockCount, icon: PackageX, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    {
      label: "Stock value",
      value: `₹${stockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      icon: IndianRupee,
      tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Inventory</h1>
          <p className="text-muted text-sm mt-1">{activeOutlet?.address} · Stock is deducted automatically when the kitchen marks an order ready.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenReorderModal}
            className="flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-md transition border border-slate-700 dark:border-amber-300"
          >
            <Sparkles size={17} className="text-amber-400 dark:text-slate-950" />
            <span>What to Buy</span>
            {criticalOrders.length > 0 && <span className="bg-rose-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full">{criticalOrders.length}</span>}
          </button>

          <button onClick={openAddModal} className="flex items-center gap-2 bg-surface hover:bg-surface-2 border border-border text-ink font-medium px-4 py-2.5 rounded-xl transition">
            <Plus size={17} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {(pageError || stock.error) && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {pageError || stock.error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-surface border border-border rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${tone}`}>
              <Icon size={20} />
            </div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-ink mt-1">{loaded ? value : "—"}</p>
          </div>
        ))}
      </div>

      <div className="relative sm:max-w-xs">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search ingredients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400 transition"
        />
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
        {!loaded ? (
          <p className="py-16 text-center text-sm text-muted">Loading stock...</p>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-surface-2 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-muted">
              <Package size={28} />
            </div>
            <p className="font-semibold text-ink">No inventory items found</p>
            <p className="text-muted text-xs mt-1">Add items to this outlet to start tracking.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                <th className="px-5 py-3.5">Ingredient</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Lead time</th>
                <th className="px-5 py-3.5">Unit cost</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleItems.map((item) => {
                const config = statusConfig[item.status] || statusConfig.ok;
                return (
                  <tr key={item.id} className={`hover:bg-surface-2/40 transition-colors ${config.rowTint}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Safety level: {item.safetyStockLevel} {item.unit}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-ink">
                      <strong>{item.currentStock}</strong> {item.unit}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink text-xs">{item.reorderDelayDays} days</td>
                    <td className="px-5 py-4 text-ink text-xs">
                      ₹{item.costPerUnit} <span className="text-muted">/{item.unit}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openMovement(item, "PURCHASE")}
                          className="text-muted hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-500/10 transition"
                          aria-label={`Record stock received for ${item.name}`}
                          title="Stock received"
                        >
                          <Truck size={15} />
                        </button>
                        <button
                          onClick={() => openMovement(item, "WASTE")}
                          className="text-muted hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-500/10 transition"
                          aria-label={`Record wastage for ${item.name}`}
                          title="Wastage"
                        >
                          <PackageX size={15} />
                        </button>
                        <button onClick={() => openEditModal(item)} className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface-2 transition" aria-label={`Edit ${item.name}`} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="text-muted hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                          aria-label={`Delete ${item.name}`}
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

      {isReorderModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-start justify-between bg-surface-2/60">
              <div>
                <h2 className="text-xl font-bold text-ink">What to buy — {activeOutlet?.address}</h2>
                <p className="text-xs text-muted mt-1">
                  Based on the last 90 days of completed orders, your recipes, lead times and shelf life. Forecasts are estimates.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchReorderAlerts} className="p-2 text-muted hover:text-ink rounded-xl" aria-label="Refresh forecast">
                  <RefreshCw size={17} className={forecast.loading ? "animate-spin" : ""} />
                </button>
                <button onClick={() => setIsReorderModalOpen(false)} className="p-2 text-muted hover:text-ink rounded-xl" aria-label="Close">
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {[
                  ["critical", `🚨 Order now (${criticalOrders.length})`],
                  ["warning", `⚠️ Next 7 days (${criticalOrders.length + warningOrders.length})`],
                  ["all", `All items (${alerts.length})`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setReorderFilter(key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${reorderFilter === key ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-surface-2 text-muted hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filteredReorderAlerts.length > 0 && (
                <button onClick={copyChecklistToClipboard} className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-2 border border-border rounded-xl text-xs font-semibold text-ink">
                  {copiedChecklist ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copiedChecklist ? "Copied!" : "Copy checklist"}
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {forecast.loading ? (
                <p className="py-16 text-center text-sm font-bold text-ink">Forecasting ingredient usage...</p>
              ) : forecast.error ? (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm">
                  <p className="font-bold mb-1">Could not generate forecast</p>
                  <p className="text-xs">{forecast.error}</p>
                </div>
              ) : filteredReorderAlerts.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <CheckCircle2 size={44} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-base font-bold text-ink">Nothing to reorder in this view</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReorderAlerts.map((alert) => (
                    <ReorderCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {movement && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={saveMovement} className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">{movement.type === "PURCHASE" ? "Stock received" : "Record wastage"}</h2>
                <p className="text-xs text-muted">
                  {movement.item.name} · now {movement.item.currentStock} {movement.item.unit}
                </p>
              </div>
              <button type="button" onClick={() => setMovement(null)} className="text-muted hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-muted mb-1 block uppercase">
                {movement.type === "PURCHASE" ? "Quantity received" : "Quantity thrown away"} ({movement.item.unit})
              </span>
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={movement.quantity}
                onChange={(e) => setMovement({ ...movement, quantity: e.target.value })}
                className={inputClass}
              />
            </label>
            {movement.type === "PURCHASE" && (
              <label className="block">
                <span className="text-xs font-semibold text-muted mb-1 block uppercase">Price paid per {movement.item.unit} (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={movement.unitCost}
                  onChange={(e) => setMovement({ ...movement, unitCost: e.target.value })}
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] text-muted">Updates the cost used for recipe costing.</span>
              </label>
            )}
            {movement.error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {movement.error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setMovement(null)} className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-xl hover:bg-surface-2 transition">
                Cancel
              </button>
              <button
                type="submit"
                disabled={movement.saving}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 font-bold py-2.5 rounded-xl transition disabled:opacity-60"
              >
                {movement.saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveItem} className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-ink">{editingItemId ? "Edit stock item" : "Add stock item"}</h2>
                <p className="text-xs text-muted">{activeOutlet?.address}</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-muted mb-1 block uppercase">Ingredient name</span>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Basmati Rice" className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Current stock</span>
                  <input type="number" min="0" step="any" value={formData.currentStock} onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Unit</span>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className={inputClass}>
                    {[...new Set([...UNITS, formData.unit])].map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Safety stock</span>
                  <input type="number" min="0" step="any" value={formData.safetyStockLevel} onChange={(e) => setFormData({ ...formData, safetyStockLevel: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Supplier lead (days)</span>
                  <input type="number" min="0" value={formData.reorderDelayDays} onChange={(e) => setFormData({ ...formData, reorderDelayDays: e.target.value })} className={inputClass} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Cost / unit (₹)</span>
                  <input type="number" min="0" step="any" value={formData.costPerUnit} onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted mb-1 block uppercase">Shelf life (days)</span>
                  <input type="number" min="0" value={formData.shelfLifeDays} onChange={(e) => setFormData({ ...formData, shelfLifeDays: e.target.value })} className={inputClass} />
                </label>
              </div>
              {formError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border border-border text-ink font-semibold py-2.5 rounded-xl hover:bg-surface-2 transition">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 font-bold py-2.5 rounded-xl transition disabled:opacity-60"
              >
                {saving ? "Saving..." : editingItemId ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ReorderCard({ alert }) {
  const isCritical = alert.urgency === "critical";
  const isWarning = alert.urgency === "warning";
  return (
    <div
      className={`p-4 rounded-2xl border ${
        isCritical ? "bg-rose-500/5 border-rose-500/30" : isWarning ? "bg-amber-500/5 border-amber-400/40" : "bg-surface-2/40 border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-ink text-base">{alert.ingredient_name}</h3>
          <p className="text-xs text-muted mt-0.5">
            Now: <strong className="text-ink">{alert.current_stock} {alert.unit}</strong> (safety {alert.safety_stock} {alert.unit})
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
            isCritical ? "bg-rose-600 text-white" : isWarning ? "bg-amber-400 text-slate-950" : "bg-emerald-600 text-white"
          }`}
        >
          {isCritical ? "Order now" : isWarning ? "Order soon" : "OK"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-surface border border-border text-xs mb-3">
        <div>
          <span className="text-muted block text-[10px] uppercase font-semibold">Daily use</span>
          <span className="font-bold text-ink">{alert.avg_daily_usage !== null ? `~${alert.avg_daily_usage} ${alert.unit}` : "N/A"}</span>
        </div>
        <div>
          <span className="text-muted block text-[10px] uppercase font-semibold">Runway</span>
          <span className={`font-bold ${isCritical ? "text-rose-600 dark:text-rose-400" : "text-ink"}`}>
            {alert.days_until_safety_breach !== null ? `${alert.days_until_safety_breach}d to safety level` : "30d+"}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[10px] uppercase font-semibold">Lead time</span>
          <span className="font-bold text-ink">{alert.reorder_delay_days}d</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs gap-2">
        <span className="flex items-center gap-1.5 text-muted">
          <Calendar size={13} className="text-ink" />
          Order by <strong className="text-ink">{alert.order_by_date || "—"}</strong>
        </span>
        <span className="bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold px-2.5 py-0.5 rounded-lg">
          +{alert.recommended_order_qty} {alert.unit}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted">{alert.method_label}</p>
    </div>
  );
}
