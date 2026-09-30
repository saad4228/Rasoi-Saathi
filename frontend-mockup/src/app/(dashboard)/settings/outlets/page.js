"use client";

import { useState } from "react";
import { CheckCircle2, MapPin, Pencil, Phone, Plus, Store, X } from "lucide-react";
import { useOutlets } from "@/context/OutletContext";
import { apiRequest } from "@/services/api";

const emptyOutlet = {
  address: "",
  phone: "",
  supports_dine_in: true,
  supports_takeaway: true,
  supports_delivery: true,
  is_active: true,
};

const SERVICES = [
  ["supports_dine_in", "Dine-in"],
  ["supports_takeaway", "Takeaway"],
  ["supports_delivery", "Delivery"],
];

export default function OutletsPage() {
  const { outlets, outletsLoaded, outletsError, activeOutletId, setActiveOutletId, refreshOutlets, restaurantName } = useOutlets();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyOutlet);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditingId(null);
    setFormData(emptyOutlet);
    setError("");
    setIsModalOpen(true);
  }

  function openEdit(outlet) {
    setEditingId(outlet.id);
    setFormData({
      address: outlet.address || "",
      phone: outlet.phone || "",
      supports_dine_in: outlet.supports_dine_in,
      supports_takeaway: outlet.supports_takeaway,
      supports_delivery: outlet.supports_delivery,
      is_active: outlet.is_active,
    });
    setError("");
    setIsModalOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!formData.address.trim()) {
      setError("Enter the outlet's address or name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...formData, address: formData.address.trim(), phone: formData.phone.trim() || null };
      const saved = await apiRequest(editingId ? `/api/branches/${editingId}` : "/api/branches", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      refreshOutlets();
      if (!editingId) setActiveOutletId(saved.id);
      setIsModalOpen(false);
    } catch (saveError) {
      setError(saveError.message || "The outlet could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">{restaurantName || "My Restaurant"} — Outlets</h1>
          <p className="text-muted mt-1">Each outlet has its own stock, recipes and order queue.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium px-4 py-2 rounded-xl hover:opacity-90 transition"
        >
          <Plus size={18} />
          Add Outlet
        </button>
      </div>

      {outletsError && (
        <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {outletsError.message}
        </p>
      )}

      {!outletsLoaded ? (
        <p className="text-sm text-muted">Loading outlets...</p>
      ) : outlets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          No outlets yet. Add your first outlet to start taking orders.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {outlets.map((outlet) => {
            const isActive = outlet.id === activeOutletId;
            return (
              <div
                key={outlet.id}
                className={`bg-surface border rounded-2xl p-6 transition ${isActive ? "border-accent ring-1 ring-accent" : "border-border"}`}
              >
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-surface-2 p-2.5 rounded-xl">
                      <Store className="text-accent" size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink truncate">{outlet.address || "Unnamed outlet"}</h3>
                      {isActive && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 size={12} />
                          Currently selected
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${outlet.is_active ? "text-green-600" : "text-muted"}`}>
                    <span className={`w-2 h-2 rounded-full ${outlet.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                    {outlet.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-2.5 text-sm text-muted">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 shrink-0" />
                    <span>{outlet.address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="shrink-0" />
                    <span>{outlet.phone || "No phone added"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SERVICES.map(([key, label]) => (
                      <span
                        key={key}
                        className={`text-xs px-2 py-0.5 rounded-full border ${outlet[key] ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted line-through"}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setActiveOutletId(outlet.id)}
                    disabled={isActive}
                    className={`flex-1 text-sm font-medium py-2 rounded-xl transition ${
                      isActive ? "bg-surface-2 text-muted cursor-not-allowed" : "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:opacity-90"
                    }`}
                  >
                    {isActive ? "Currently selected" : "Switch to this outlet"}
                  </button>
                  <button
                    onClick={() => openEdit(outlet)}
                    aria-label={`Edit ${outlet.address}`}
                    className="flex items-center justify-center border border-border text-ink text-sm font-medium px-4 py-2 rounded-xl hover:bg-surface-2 transition"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-surface rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">{editingId ? "Edit outlet" : "Add new outlet"}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-muted hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-muted mb-1 block">Address / outlet name</span>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 12 Central Market, Nagpur"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </label>
              <label className="block">
                <span className="text-sm text-muted mb-1 block">Phone</span>
                <input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </label>
              <fieldset>
                <legend className="text-sm text-muted mb-2">Services offered</legend>
                <div className="flex flex-wrap gap-4">
                  {SERVICES.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                Outlet is open for orders
              </label>
              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border border-border text-ink font-medium py-2.5 rounded-xl hover:bg-surface-2 transition">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save outlet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
