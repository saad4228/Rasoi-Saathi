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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const statusConfig = {
  ok: { label: "In Stock", dot: "bg-green-500", text: "text-green-600", rowTint: "" },
  low: { label: "Low Stock", dot: "bg-orange-500", text: "text-orange-600", rowTint: "bg-orange-500/5" },
  out: { label: "Out of Stock", dot: "bg-red-500", text: "text-red-600", rowTint: "bg-red-500/5" },
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

  useEffect(() => {
    apiRequest("/api/branches", {}, session).then((loaded) => {
      setBranches(loaded);
      if (loaded[0]) setSelectedBranchId(loaded[0].id);
    }).catch(() => setBranches([]));
    apiRequest("/api/inventory-items", {}, session)
      .then((loaded) => setItems(loaded.map(mapInventoryItem)))
      .catch(() => setItems([]));
  }, [session]);

  // Stat card numbers, recalculated whenever items change
  const totalItems = items.length;
  const lowStockCount = items.filter((i) => i.status === "low").length;
  const outOfStockCount = items.filter((i) => i.status === "out").length;
  const atRiskCount = items.filter((i) => i.status === "low").length;

  // Filtering + "problems first" sorting, recalculated whenever inputs change
  const visibleItems = useMemo(() => {
    let result = selectedBranchId ? items.filter((i) => i.branch_id === selectedBranchId) : items;
    if (searchQuery.trim()) {
      result = result.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort so "out" comes before "low" comes before "ok"
    const statusOrder = { out: 0, low: 1, ok: 2 };
    return [...result].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [items, selectedBranchId, searchQuery]);

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveItem() {
    const payload = { branch_id: formData.branch_id, name: formData.name, unit: formData.unit, current_stock: Number(formData.currentStock) || 0, safety_stock_level: Number(formData.safetyStockLevel) || 0, reorder_delay_days: Number(formData.reorderDelayDays) || 0, cost_per_unit: Number(formData.costPerUnit) || 0, shelf_life_days: formData.shelfLifeDays ? Number(formData.shelfLifeDays) : null };
    const created = await apiRequest(editingItemId ? `/api/inventory-items/${editingItemId}` : "/api/inventory-items", { method: editingItemId ? "PATCH" : "POST", body: JSON.stringify(payload) }, session);
    const mapped = mapInventoryItem(created);
    setItems((prev) => editingItemId ? prev.map((item) => item.id === editingItemId ? mapped : item) : [...prev, mapped]);
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
    setFormData({ branch_id: item.branch_id, name: item.name, currentStock: item.currentStock, unit: item.unit, safetyStockLevel: item.safetyStockLevel, reorderDelayDays: item.reorderDelayDays, costPerUnit: item.costPerUnit, shelfLifeDays: item.shelfLifeDays || "" });
    setIsModalOpen(true);
  }

  async function handleDeleteItem(id) {
    if (!window.confirm("Delete this inventory item and its recipe link?")) return;
    await apiRequest(`/api/inventory-items/${id}`, { method: "DELETE" }, session);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Inventory</h1>
          <p className="text-muted mt-1">
            AI-predicted stock levels and reorder alerts.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium px-4 py-2 rounded-xl hover:opacity-90 transition"
        >
          <Plus size={18} />
          Add Stock Item
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <Package className="text-blue-500" size={18} />
          </div>
          <p className="text-sm text-muted">Total Items Tracked</p>
          <p className="text-2xl font-bold text-ink mt-1">{totalItems}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="bg-orange-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <AlertTriangle className="text-orange-500" size={18} />
          </div>
          <p className="text-sm text-muted">Low Stock Items</p>
          <p className="text-2xl font-bold text-ink mt-1">{lowStockCount}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="bg-red-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <PackageX className="text-red-500" size={18} />
          </div>
          <p className="text-sm text-muted">Out of Stock</p>
          <p className="text-2xl font-bold text-ink mt-1">{outOfStockCount}</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="bg-accent/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
            <TrendingDown className="text-accent" size={18} />
          </div>
          <p className="text-sm text-muted">At Risk This Week</p>
          <p className="text-2xl font-bold text-ink mt-1">{atRiskCount}</p>
        </div>
      </div>

      {/* Search + branch filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-orange-400">
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.address || "Branch"}</option>)}
        </select>
      </div>

      {/* Inventory table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-orange-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Package className="text-accent" size={28} />
            </div>
            <p className="font-semibold text-ink">No items found</p>
            <p className="text-muted text-sm mt-1">
              Add an inventory item to start tracking stock.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Current Stock</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Reorder Delay</th>
                <th className="px-5 py-3 font-medium">Cost / Unit</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const config = statusConfig[item.status];
                const fillPct = item.safetyStockLevel > 0 ? Math.min(100, Math.round((item.currentStock / item.safetyStockLevel) * 100)) : 100;

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 ${config.rowTint}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-muted">Safety: {item.safetyStockLevel} {item.unit}</p>
                    </td>
                    <td className="px-5 py-4 w-48">
                      <p className="text-ink font-medium mb-1.5">
                        {item.currentStock} {item.unit}
                        <span className="text-muted font-normal">
                          {" "}/ {item.safetyStockLevel} {item.unit}
                        </span>
                      </p>
                      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.status === "out"
                              ? "bg-red-500"
                              : item.status === "low"
                              ? "bg-orange-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span className={config.text}>{config.label}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink">{item.reorderDelayDays} days</td>
                    <td className="px-5 py-4 text-muted">₹{item.costPerUnit}</td>
                    <td className="px-5 py-4"><div className="flex gap-2"><button onClick={() => openEditModal(item)} className="text-muted hover:text-accent" title="Edit inventory item"><Pencil size={16} /></button><button onClick={() => handleDeleteItem(item.id)} className="text-muted hover:text-red-500" title="Delete inventory item"><Trash2 size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">{editingItemId ? "Edit Inventory Item" : "Add Stock Item"}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1 block">Branch</label>
                <select value={formData.branch_id} onChange={(e) => handleFormChange("branch_id", e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400">
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.address || "Branch"}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted mb-1 block">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">Current Stock</label>
                  <input
                    type="number"
                    value={formData.currentStock}
                    onChange={(e) => handleFormChange("currentStock", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => handleFormChange("unit", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Safety Stock Level</label>
                  <input
                    type="number"
                    value={formData.safetyStockLevel}
                    onChange={(e) => handleFormChange("safetyStockLevel", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">Reorder Delay (days)</label>
                  <input type="number" min="0" value={formData.reorderDelayDays} onChange={(e) => handleFormChange("reorderDelayDays", e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Cost Per Unit</label>
                  <input type="number" min="0" value={formData.costPerUnit} onChange={(e) => handleFormChange("costPerUnit", e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted mb-1 block">Shelf Life (days)</label>
                <input type="number" min="0" value={formData.shelfLifeDays} onChange={(e) => handleFormChange("shelfLifeDays", e.target.value)} className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 border border-border text-ink font-medium py-2.5 rounded-xl hover:bg-surface-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition"
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