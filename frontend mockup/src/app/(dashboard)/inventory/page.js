"use client";

import { useState, useMemo } from "react";
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingDown,
  Sparkles,
  X,
  PackageX,
} from "lucide-react";

// Mock inventory data — later this comes from your backend's XGBoost model
const initialItems = [
  {
    id: 1,
    name: "Paneer",
    category: "Dairy",
    currentStock: 1.2,
    unit: "kg",
    idealStock: 8,
    dailyUsage: 2.4,
    status: "low", // "ok" | "low" | "out"
  },
  {
    id: 2,
    name: "Basmati Rice",
    category: "Staples",
    currentStock: 24,
    unit: "kg",
    idealStock: 30,
    dailyUsage: 3.1,
    status: "ok",
  },
  {
    id: 3,
    name: "Chicken (Boneless)",
    category: "Meat",
    currentStock: 0,
    unit: "kg",
    idealStock: 15,
    dailyUsage: 5.2,
    status: "out",
  },
  {
    id: 4,
    name: "Tomatoes",
    category: "Vegetables",
    currentStock: 3.5,
    unit: "kg",
    idealStock: 12,
    dailyUsage: 4.8,
    status: "low",
  },
  {
    id: 5,
    name: "Cooking Oil",
    category: "Staples",
    currentStock: 18,
    unit: "L",
    idealStock: 20,
    dailyUsage: 1.5,
    status: "ok",
  },
  {
    id: 6,
    name: "Garam Masala",
    category: "Spices",
    currentStock: 2,
    unit: "kg",
    idealStock: 3,
    dailyUsage: 0.2,
    status: "ok",
  },
];

const categories = ["All", "Vegetables", "Dairy", "Meat", "Staples", "Spices", "Packaging"];

// Turns a status into a badge's color, dot color, and label — one place to edit all three
const statusConfig = {
  ok: { label: "In Stock", dot: "bg-green-500", text: "text-green-600", rowTint: "" },
  low: { label: "Low Stock", dot: "bg-orange-500", text: "text-orange-600", rowTint: "bg-orange-500/5" },
  out: { label: "Out of Stock", dot: "bg-red-500", text: "text-red-600", rowTint: "bg-red-500/5" },
};

// A simple stand-in "prediction" — days left = current stock ÷ how much is used per day
function daysUntilEmpty(item) {
  if (item.dailyUsage <= 0) return null;
  const days = item.currentStock / item.dailyUsage;
  return Math.max(0, Math.round(days * 10) / 10);
}

const emptyItem = {
  name: "",
  category: "Vegetables",
  currentStock: "",
  unit: "kg",
  idealStock: "",
  dailyUsage: "",
  status: "ok",
};

export default function InventoryPage() {
  const [items, setItems] = useState(initialItems);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyItem);

  // Stat card numbers, recalculated whenever items change
  const totalItems = items.length;
  const lowStockCount = items.filter((i) => i.status === "low").length;
  const outOfStockCount = items.filter((i) => i.status === "out").length;
  const atRiskCount = items.filter((i) => {
    const days = daysUntilEmpty(i);
    return days !== null && days <= 3 && i.status !== "out";
  }).length;

  // The single most urgent item, used for the Copilot insight banner text
  const mostUrgentItem = useMemo(() => {
    const withDays = items
      .filter((i) => i.status !== "out")
      .map((i) => ({ ...i, days: daysUntilEmpty(i) }))
      .filter((i) => i.days !== null)
      .sort((a, b) => a.days - b.days);
    return withDays[0] || null;
  }, [items]);

  // Filtering + "problems first" sorting, recalculated whenever inputs change
  const visibleItems = useMemo(() => {
    let result = items;

    if (activeCategory !== "All") {
      result = result.filter((i) => i.category === activeCategory);
    }
    if (searchQuery.trim()) {
      result = result.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort so "out" comes before "low" comes before "ok"
    const statusOrder = { out: 0, low: 1, ok: 2 };
    return [...result].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [items, activeCategory, searchQuery]);

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddItem() {
    const newItem = {
      ...formData,
      id: Date.now(),
      currentStock: parseFloat(formData.currentStock) || 0,
      idealStock: parseFloat(formData.idealStock) || 0,
      dailyUsage: parseFloat(formData.dailyUsage) || 0,
    };
    setItems((prev) => [...prev, newItem]);
    setFormData(emptyItem);
    setIsModalOpen(false);
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
          onClick={() => setIsModalOpen(true)}
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

      {/* Copilot insight banner */}
      {mostUrgentItem && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-5 mb-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent mb-1">
            <Sparkles size={16} />
            RASOISAATHI COPILOT INSIGHT
          </p>
          <p className="text-ink text-sm">
            <span className="font-semibold">{mostUrgentItem.name}</span> will
            run out in ~{mostUrgentItem.days} day
            {mostUrgentItem.days === 1 ? "" : "s"} at current usage. Consider
            reordering soon to avoid a stockout.
          </p>
        </div>
      )}

      {/* Search + category filters */}
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
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                activeCategory === cat
                  ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white"
                  : "bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
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
              Try a different search or category.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Current Stock</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Predicted Depletion</th>
                <th className="px-5 py-3 font-medium">Daily Usage (AI)</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const config = statusConfig[item.status];
                const days = daysUntilEmpty(item);
                const fillPct = Math.min(
                  100,
                  Math.round((item.currentStock / item.idealStock) * 100)
                );

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 ${config.rowTint}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-muted">{item.category}</p>
                    </td>
                    <td className="px-5 py-4 w-48">
                      <p className="text-ink font-medium mb-1.5">
                        {item.currentStock} {item.unit}
                        <span className="text-muted font-normal">
                          {" "}/ {item.idealStock} {item.unit}
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
                    <td className="px-5 py-4 text-ink">
                      {item.status === "out"
                        ? "—"
                        : days !== null
                        ? `~${days} day${days === 1 ? "" : "s"}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {item.dailyUsage} {item.unit}/day
                    </td>
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
              <h2 className="text-lg font-bold text-ink">Add Stock Item</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1 block">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-1 block">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {categories.filter((c) => c !== "All").map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">Ideal Stock Level</label>
                  <input
                    type="number"
                    value={formData.idealStock}
                    onChange={(e) => handleFormChange("idealStock", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Avg. Daily Usage</label>
                  <input
                    type="number"
                    value={formData.dailyUsage}
                    onChange={(e) => handleFormChange("dailyUsage", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted mb-1 block">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="ok">In Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
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
                onClick={handleAddItem}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}