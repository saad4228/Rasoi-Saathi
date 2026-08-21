"use client";

import { useState } from "react";
import { ChefHat } from "lucide-react";

// Temporary mock data — we'll replace this with real order data later
const mockOrders = [
  // Empty for now, so you see the empty state first.
  // Example of what a real order object will look like:
  // { id: "1248", source: "WhatsApp", customer: "Rahul S.", items: "2x Veg Biryani", status: "pending", time: "12:30 PM" },
];

const statusFilters = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending", dot: "bg-orange-500" },
  { key: "preparing", label: "Preparing", dot: "bg-amber-400" },
  { key: "ready", label: "Ready", dot: "bg-green-500" },
  { key: "served", label: "Served", dot: "bg-blue-500" },
  { key: "rejected", label: "Rejected", dot: "bg-red-500" },
];

export default function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const countFor = (key) =>
    key === "all"
      ? mockOrders.length
      : mockOrders.filter((o) => o.status === key).length;

  const filteredOrders =
    activeFilter === "all"
      ? mockOrders
      : mockOrders.filter((o) => o.status === activeFilter);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
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

function OrderCard({ order }) {
  const statusStyles = {
    pending: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
    preparing: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    ready: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    served: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  };

  return (
    <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          #{order.id} · {order.source}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[order.status]}`}
        >
          {order.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{order.customer}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{order.items}</p>
      <p className="text-xs text-gray-400 mt-2">{order.time}</p>
    </div>
  );
}
