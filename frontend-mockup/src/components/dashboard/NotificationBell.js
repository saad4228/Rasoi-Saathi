"use client";

import { useEffect, useState } from "react";
import { Bell, Clock, Package, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOutlets } from "@/context/OutletContext";
import { apiRequest } from "@/services/api";

const REFRESH_MS = 30_000;
const STUCK_AFTER_MINUTES = 20;

const typeConfig = {
  order: { icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/10" },
  ready: { icon: UtensilsCrossed, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  stock: { icon: Package, color: "text-orange-500", bg: "bg-orange-500/10" },
  stuck: { icon: Clock, color: "text-red-500", bg: "bg-red-500/10" },
};

function describeItems(order) {
  return order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ");
}

function buildNotifications(orders, stock, role, now) {
  const kitchen = role === "owner" || role === "chef";
  const floor = role === "owner" || role === "waiter";
  const notes = [];
  for (const order of orders) {
    const minutes = Math.round((now - new Date(order.ordered_at).getTime()) / 60_000);
    const label = `#${order.id.slice(0, 8)}`;
    if (kitchen && order.status === "PENDING") {
      notes.push({ id: `new:${order.id}`, type: "order", title: `New ${order.order_source.toLowerCase()} order ${label}`, description: describeItems(order), minutes });
    }
    if (floor && order.status === "READY") {
      notes.push({ id: `ready:${order.id}`, type: "ready", title: `Order ${label} is ready`, description: describeItems(order), minutes });
    }
    if (kitchen && ["PENDING", "CONFIRMED", "PREPARING"].includes(order.status) && minutes >= STUCK_AFTER_MINUTES) {
      notes.push({ id: `stuck:${order.id}:${order.status}`, type: "stuck", title: `Order ${label} waiting ${minutes} min`, description: `Still ${order.status.toLowerCase()}`, minutes });
    }
  }
  for (const item of stock) {
    if (item.status !== "ok") {
      notes.push({
        id: `stock:${item.id}:${item.status}`,
        type: "stock",
        title: item.status === "out" ? `${item.name} is out of stock` : `Low stock: ${item.name}`,
        description: `${Number(item.current_stock)} ${item.unit} left (safety ${Number(item.safety_stock_level)} ${item.unit})`,
        minutes: null,
      });
    }
  }
  return notes;
}

export default function NotificationBell() {
  const { applicationUser } = useAuth();
  const { activeOutletId } = useOutlets();
  const role = applicationUser?.role;
  const [isOpen, setIsOpen] = useState(false);
  const [feed, setFeed] = useState({ outletId: null, notes: [] });
  const [readIds, setReadIds] = useState([]);

  useEffect(() => {
    if (!activeOutletId || !role) return undefined;
    let cancelled = false;
    const load = async () => {
      const now = Date.now();
      const since = new Date(now - 12 * 3_600_000).toISOString();
      try {
        const [orders, stock] = await Promise.all([
          apiRequest(`/api/orders?branch_id=${activeOutletId}&since=${encodeURIComponent(since)}&limit=200`),
          role === "waiter" ? Promise.resolve([]) : apiRequest(`/api/inventory-items?branch_id=${activeOutletId}`),
        ]);
        if (!cancelled) setFeed({ outletId: activeOutletId, notes: buildNotifications(orders, stock, role, now) });
      } catch {
        /* notifications are best-effort; pages show their own errors */
      }
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOutletId, role]);

  const notifications = feed.outletId === activeOutletId ? feed.notes : [];
  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        className="relative w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform"
      >
        <Bell size={16} className="text-ink" />
        {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={() => setReadIds(notifications.map((n) => n.id))} className="text-xs text-accent font-medium hover:underline">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">Nothing needs your attention.</p>
              ) : (
                notifications.map((n) => {
                  const config = typeConfig[n.type];
                  const Icon = config.icon;
                  const unread = !readIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]))}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition border-b border-border last:border-0 ${unread ? "bg-surface-2/50" : ""}`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${config.bg}`}>
                        <Icon size={14} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.description}</p>
                        {n.minutes !== null && <p className="text-xs text-muted mt-1">{n.minutes <= 0 ? "just now" : `${n.minutes} min ago`}</p>}
                      </div>
                      {unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
