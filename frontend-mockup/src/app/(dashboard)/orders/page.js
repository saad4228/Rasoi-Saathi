"use client";

import { ChefHat, ChevronRight, Clock3, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const statusFilters = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", dot: "bg-orange-500" },
  { key: "confirmed", label: "Confirmed", dot: "bg-blue-500" },
  { key: "preparing", label: "Preparing", dot: "bg-amber-400" },
  { key: "ready", label: "Ready", dot: "bg-green-500" },
  { key: "completed", label: "Completed", dot: "bg-emerald-500" },
  { key: "cancelled", label: "Cancelled", dot: "bg-red-500" },
];

export default function OrdersPage() {
  const { session } = useAuth();
  const [activeFilter, setActiveFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  useEffect(() => {
    apiRequest("/api/orders", {}, session)
      .then((loaded) => setOrders(loaded.map((order) => ({
        ...order,
        orderId: order.id,
        displayId: order.id.slice(0, 8),
        source: order.order_source,
        customer: "Restaurant order",
        items: order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", "),
        time: new Date(order.ordered_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      }))))
      .catch(() => setOrders([]));
  }, [session]);

  const countFor = (key) =>
    key === "all"
      ? orders.length
      : orders.filter((o) => o.status.toLowerCase() === key).length;

  const filteredOrders =
    activeFilter === "all"
      ? orders
      : orders.filter((o) => o.status.toLowerCase() === activeFilter);

  async function updateOrderStatus(orderId, status) {
    setUpdatingOrderId(orderId);
    try {
      const updated = await apiRequest(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: status.toUpperCase() }) }, session);
      setOrders((current) => current.map((order) => order.orderId === orderId ? { ...order, status: updated.status } : order));
    } catch (error) {
      window.alert(error.message || "The order status could not be updated.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
       <h1 className="text-2xl font-bold text-ink">
  Live Orders
</h1>
<p className="text-muted mt-1">
          Monitor incoming tickets and update kitchen preparation status.
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {statusFilters.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white border-transparent"
                    : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-neutral-700 hover:border-orange-300"
                }`}
            >
              {filter.dot && (
                <span className={`w-2 h-2 rounded-full ${filter.dot}`} />
              )}
              {filter.label}
              {filter.key !== "all" && ` (${countFor(filter.key)})`}
            </button>
          );
        })}
      </div>

      {/* Orders list OR empty state */}
      {filteredOrders.length === 0 ? (
        <EmptyOrdersState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
          {filteredOrders.map((order) => (
            <OrderCard key={order.orderId} order={order} updating={updatingOrderId === order.orderId} onStatusChange={updateOrderStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyOrdersState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/10 dark:to-amber-400/10 flex items-center justify-center mb-6">
        <ChefHat className="w-14 h-14 text-orange-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-bold text-ink">
  No Active Orders!
</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
        The queue is currently clear. Any new orders will show up here
        automatically.
      </p>
    </div>
  );
}

function OrderCard({ order, updating, onStatusChange }) {
  const statusStyles = {
    pending: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    preparing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    ready: "bg-green-500/10 text-green-600 dark:text-green-300",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    cancelled: "bg-red-500/10 text-red-600 dark:text-red-300",
  };
  const normalizedStatus = order.status.toLowerCase();
  const statusLabel = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-5 hover:bg-surface-2 transition-colors">
      <div className="hidden sm:flex w-10 h-10 rounded-xl bg-accent/10 text-accent items-center justify-center">
        <ReceiptText size={18} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold text-ink">#{order.displayId}</span>
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{order.source}</span>
          <span className="text-xs text-muted">{order.order_type?.replace("_", " ")}</span>
        </div>
        <p className="text-sm text-ink mt-1 truncate">{order.items || "No item details"}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted mt-1"><Clock3 size={12} />{order.time}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block"><p className="text-sm font-bold text-ink">₹{Number(order.total_amount || 0).toLocaleString("en-IN")}</p><p className="text-xs text-muted">Total</p></div>
        <select
          value={normalizedStatus}
          disabled={updating}
          onChange={(event) => onStatusChange(order.orderId, event.target.value)}
          aria-label={`Change status for order ${order.displayId}`}
          className={`whitespace-nowrap text-xs font-bold px-2.5 py-1.5 rounded-full border-0 outline-none cursor-pointer ${statusStyles[normalizedStatus] || "bg-surface-2 text-muted"}`}
        >
          {statusFilters.filter((filter) => filter.key !== "all").map((filter) => (
            <option key={filter.key} value={filter.key}>{filter.label}</option>
          ))}
        </select>
        <ChevronRight size={16} className="text-muted/50 group-hover:text-accent transition-colors" />
      </div>
    </div>
  );
}
