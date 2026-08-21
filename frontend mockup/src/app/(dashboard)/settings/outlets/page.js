"use client";
import { useOutlets } from "@/context/OutletContext";
import { useState } from "react";
import {
  Store,
  MapPin,
  Phone,
  Clock,
  FileText,
  Plus,
  X,
  Pencil,
  CheckCircle2,
} from "lucide-react";

const initialOutlets = [
  {
    id: 1,
    name: "Red Villa Restaurant",
    isPrimary: true,
    status: "Active",
    address: "Shop 4, Linking Road, Andheri West, Mumbai",
    phone: "+91 98765 43210",
    cuisine: "North Indian, Chinese",
    openTime: "11:00 AM",
    closeTime: "11:00 PM",
    gst: "27ABCDE1234F1Z5",
    fssai: "12345678901234",
  },
  {
    id: 2,
    name: "Red Villa Restaurant",
    isPrimary: false,
    status: "Active",
    address: "Unit 12, Hiranandani Gardens, Powai, Mumbai",
    phone: "+91 91234 56789",
    cuisine: "North Indian, Chinese",
    openTime: "12:00 PM",
    closeTime: "10:30 PM",
    gst: "27ABCDE1234F1Z6",
    fssai: "12345678901235",
  },
];

const emptyOutlet = {
  name: "",
  address: "",
  phone: "",
  cuisine: "",
  openTime: "",
  closeTime: "",
  gst: "",
  fssai: "",
  status: "Active",
  isPrimary: false,
};

export default function OutletsPage() {
  const { outlets, setOutlets, activeOutletId, setActiveOutletId } = useOutlets(); // which outlet is "currently viewing"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyOutlet);

  function handleAddClick() {
    setEditingId(null);
    setFormData(emptyOutlet);
    setIsModalOpen(true);
  }

  function handleEditClick(outlet) {
    setEditingId(outlet.id);
    setFormData(outlet);
    setIsModalOpen(true);
  }

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (editingId === null) {
      const newOutlet = { ...formData, id: Date.now() };
      setOutlets((prev) => [...prev, newOutlet]);
    } else {
      setOutlets((prev) =>
        prev.map((o) => (o.id === editingId ? { ...formData, id: editingId } : o))
      );
    }
    setIsModalOpen(false);
  }

  function handleSwitchOutlet(id) {
    setActiveOutletId(id);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Restaurant / Outlets</h1>
          <p className="text-muted mt-1">
            Manage your restaurant locations, hours, and licenses.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium px-4 py-2 rounded-xl hover:opacity-90 transition"
        >
          <Plus size={18} />
          Add Outlet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {outlets.map((outlet) => {
          const isActive = outlet.id === activeOutletId;

          return (
            <div
              key={outlet.id}
              className={`bg-surface border rounded-2xl p-6 transition ${
                isActive ? "border-accent ring-1 ring-accent" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-surface-2 p-2.5 rounded-xl">
                    <Store className="text-accent" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink">{outlet.name}</h3>
                      {outlet.isPrimary && (
                        <span className="text-xs bg-orange-100 text-accent px-2 py-0.5 rounded-full font-medium">
                          Primary
                        </span>
                      )}
                      {isActive && (
                        <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 size={12} />
                          Currently Viewing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {outlet.status}
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2 text-muted">
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  <span>{outlet.address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Phone size={16} className="shrink-0" />
                  <span>{outlet.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Clock size={16} className="shrink-0" />
                  <span>{outlet.openTime} – {outlet.closeTime}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted flex items-center gap-1 mb-0.5">
                    <FileText size={12} /> GST No.
                  </p>
                  <p className="text-ink font-medium">{outlet.gst || "—"}</p>
                </div>
                <div>
                  <p className="text-muted flex items-center gap-1 mb-0.5">
                    <FileText size={12} /> FSSAI No.
                  </p>
                  <p className="text-ink font-medium">{outlet.fssai || "—"}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => handleSwitchOutlet(outlet.id)}
                  disabled={isActive}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-xl transition ${
                    isActive
                      ? "bg-surface-2 text-muted cursor-not-allowed"
                      : "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:opacity-90"
                  }`}
                >
                  {isActive ? "Currently Viewing" : "Switch to this Outlet"}
                </button>
                <button
                  onClick={() => handleEditClick(outlet)}
                  className="flex items-center justify-center gap-2 border border-border text-ink text-sm font-medium px-4 py-2 rounded-xl hover:bg-surface-2 transition"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">
                {editingId === null ? "Add New Outlet" : "Edit Outlet"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1 block">Outlet Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-1 block">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Cuisine Type</label>
                  <input
                    type="text"
                    value={formData.cuisine}
                    onChange={(e) => handleFormChange("cuisine", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">Opening Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 11:00 AM"
                    value={formData.openTime}
                    onChange={(e) => handleFormChange("openTime", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">Closing Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 11:00 PM"
                    value={formData.closeTime}
                    onChange={(e) => handleFormChange("closeTime", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted mb-1 block">GST Number</label>
                  <input
                    type="text"
                    value={formData.gst}
                    onChange={(e) => handleFormChange("gst", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted mb-1 block">FSSAI License No.</label>
                  <input
                    type="text"
                    value={formData.fssai}
                    onChange={(e) => handleFormChange("fssai", e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
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
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium py-2.5 rounded-xl hover:opacity-90 transition"
              >
                Save Outlet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}