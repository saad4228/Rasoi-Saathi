"use client";

import { useState } from "react";
import { Bell, Package, ShoppingBag, Clock, Sparkles } from "lucide-react";

// Mock notifications — later this will come from your backend (orders, inventory, etc.)
const initialNotifications = [
  {
    id: 1,
    type: "order",
    title: "New order received",
    description: "Order #1042 — Chicken Biryani x2, Raita",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "stock",
    title: "Low stock alert",
    description: "Paneer is running low — only 1.2kg left",
    time: "18 min ago",
    read: false,
  },
  {
    id: 3,
    type: "stuck",
    title: "Order taking too long",
    description: "Order #1039 has been 'Preparing' for 25 min",
    time: "25 min ago",
    read: false,
  },
  {
    id: 4,
    type: "copilot",
    title: "New Copilot insight",
    description: "Profit fell 6.8% this week — tap to see why",
    time: "1 hour ago",
    read: true,
  },
];

// Each notification type gets its own icon + color, so they're scannable at a glance
const typeConfig = {
  order: { icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/10" },
  stock: { icon: Package, color: "text-orange-500", bg: "bg-orange-500/10" },
  stuck: { icon: Clock, color: "text-red-500", bg: "bg-red-500/10" },
  copilot: { icon: Sparkles, color: "text-accent", bg: "bg-accent/10" },
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAsRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center hover:-translate-y-0.5 transition-transform"
      >
        <Bell size={16} className="text-ink" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Click outside to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-accent font-medium hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  No notifications right now.
                </p>
              ) : (
                notifications.map((n) => {
                  const config = typeConfig[n.type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition border-b border-border last:border-0 ${
                        !n.read ? "bg-surface-2/50" : ""
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${config.bg}`}>
                        <Icon size={14} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{n.title}</p>
                        <p className="text-xs text-muted mt-0.5 line-clamp-2">
                          {n.description}
                        </p>
                        <p className="text-xs text-muted mt-1">{n.time}</p>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                      )}
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