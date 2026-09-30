"use client";

import { AlertTriangle, ChefHat, Clock3, ReceiptText, User } from "lucide-react";
import { useEffect, useState } from "react";
import NoOutletNotice from "@/components/dashboard/NoOutletNotice";
import { useAuth } from "@/context/AuthContext";
import { useOutlets } from "@/context/OutletContext";
import { nextStatuses, OPEN_STATUSES, STATUS_LABELS } from "@/lib/orderStatus";
import { apiRequest } from "@/services/api";

const REFRESH_MS = 10_000;
const HISTORY_HOURS = 24;

const statusFilters = [
  { key: "open", label: "In progress" },
  { key: "PENDING", label: "Pending", dot: "bg-orange-500" },
  { key: "CONFIRMED", label: "Confirmed", dot: "bg-blue-500" },
  { key: "PREPARING", label: "Preparing", dot: "bg-amber-400" },
  { key: "READY", label: "Ready", dot: "bg-green-500" },
  { key: "COMPLETED", label: "Completed", dot: "bg-emerald-500" },
  { key: "CANCELLED", label: "Cancelled", dot: "bg-red-500" },
  { key: "all", label: `All (${HISTORY_HOURS}h)` },
];

const statusStyles = {
  PENDING: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  CONFIRMED: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  PREPARING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  READY: "bg-green-500/10 text-green-600 dark:text-green-300",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-300",
};

function matchesFilter(order, filter) {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_STATUSES.includes(order.status);
  return order.status === filter;
}

export default function OrdersPage() {
  const { applicationUser } = useAuth();
  const { activeOutletId, activeOutlet } = useOutlets();
  const role = applicationUser?.role;
  const [activeFilter, setActiveFilter] = useState("open");
  const [feed, setFeed] = useState({ outletId: null, orders: [], error: "" });
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!activeOutletId) return undefined;
    let cancelled = false;
    const load = () => {
      const since = new Date(Date.now() - HISTORY_HOURS * 3_600_000).toISOString();
      apiRequest(`/api/orders?branch_id=${activeOutletId}&since=${encodeURIComponent(since)}&limit=300`)
        .then((orders) => {
          if (!cancelled) setFeed({ outletId: activeOutletId, orders, error: "" });
        })
        .catch((error) => {
          if (!cancelled) {
            setFeed((previous) => ({
              outletId: activeOutletId,
              orders: previous.outletId === activeOutletId ? previous.orders : [],
              error: error.message || "Unable to load orders.",
            }));
          }
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOutletId]);

  if (!activeOutletId) return <NoOutletNotice />;

  const loaded = feed.outletId === activeOutletId;
  const orders = loaded ? feed.orders : [];
  const filteredOrders = orders.filter((order) => matchesFilter(order, activeFilter));

  async function updateOrderStatus(order, status) {
    if (status === "CANCELLED" && !window.confirm(`Cancel order #${order.id.slice(0, 8)}? This can't be undone.`)) return;
    setUpdatingOrderId(order.id);
    setNotice(null);
    try {
      const updated = await apiRequest(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setFeed((previous) => ({ ...previous, orders: previous.orders.map((item) => (item.id === order.id ? updated : item)) }));
      if (updated.inventory_warnings?.length) {
        setNotice({ type: "warning", text: `Order #${order.id.slice(0, 8)} is ready. Stock check: ${updated.inventory_warnings.join(" ")}` });
      }
    } catch (error) {
      setNotice({ type: "error", text: error.message || "The order status could not be updated." });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Live Orders</h1>
        <p className="text-muted mt-1">
          {activeOutlet?.address} · Updates every {REFRESH_MS / 1000} seconds.
        </p>
      </div>

      {(notice || feed.error) && (
        <div
          role="alert"
          className={`mb-6 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            notice?.type === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{notice?.text || feed.error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-8">
        {statusFilters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const count = orders.filter((order) => matchesFilter(order, filter.key)).length;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white border-transparent"
                  : "bg-surface text-muted border-border hover:border-orange-300"
              }`}
            >
              {filter.dot && <span className={`w-2 h-2 rounded-full ${filter.dot}`} />}
              {filter.label} ({count})
            </button>
          );
        })}
      </div>

      {!loaded ? (
        <p className="py-16 text-center text-sm text-muted">Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <EmptyOrdersState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              role={role}
              updating={updatingOrderId === order.id}
              onStatusChange={updateOrderStatus}
            />
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
      <h2 className="text-lg font-bold text-ink">No orders here</h2>
      <p className="text-muted mt-1 max-w-xs">New orders appear automatically within a few seconds.</p>
    </div>
  );
}

function OrderCard({ order, role, updating, onStatusChange }) {
  const options = nextStatuses(order.status, role);
  const time = new Date(order.ordered_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const items = order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ");

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-5 hover:bg-surface-2 transition-colors">
      <div className="hidden sm:flex w-10 h-10 rounded-xl bg-accent/10 text-accent items-center justify-center">
        <ReceiptText size={18} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold text-ink">#{order.id.slice(0, 8)}</span>
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{order.order_source}</span>
          <span className="text-xs text-muted">{order.order_type?.replace("_", " ")}</span>
          {order.customer_name && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <User size={12} />
              {order.customer_name}
              {order.customer_phone ? ` · ${order.customer_phone}` : ""}
            </span>
          )}
        </div>
        <p className="text-sm text-ink mt-1 truncate">{items || "No item details"}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted mt-1">
          <Clock3 size={12} />
          {time}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-ink">₹{Number(order.total_amount || 0).toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted">Total</p>
        </div>
        {options.length ? (
          <select
            value={order.status}
            disabled={updating}
            onChange={(event) => onStatusChange(order, event.target.value)}
            aria-label={`Change status for order ${order.id.slice(0, 8)}`}
            className={`whitespace-nowrap text-xs font-bold px-2.5 py-1.5 rounded-full border-0 outline-none cursor-pointer ${statusStyles[order.status] || "bg-surface-2 text-muted"}`}
          >
            <option value={order.status}>{STATUS_LABELS[order.status] || order.status}</option>
            {options.map((status) => (
              <option key={status} value={status}>
                → {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`text-xs font-bold px-2.5 py-1.5 rounded-full ${statusStyles[order.status] || "bg-surface-2 text-muted"}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        )}
      </div>
    </div>
  );
}
