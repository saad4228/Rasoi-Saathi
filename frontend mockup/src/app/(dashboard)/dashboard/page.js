"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";
import {
  Receipt,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Store,
  Clock,
} from "lucide-react";

const statIcons = [
  {
    label: "Today's Revenue",
    value: "₹18,420",
    sub: "Live from orders",
    color: "blue",
    icon: <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />,
  },
  {
    label: "Orders Today",
    value: "0",
    sub: "All channels",
    color: "orange",
    icon: <Receipt size={20} className="text-amber-600 dark:text-amber-400" />,
  },
  {
    label: "Avg. Order Value",
    value: "₹0",
    sub: "Today",
    color: "green",
    icon: <Store size={20} className="text-emerald-600 dark:text-emerald-400" />,
  },
  {
    label: "Low Stock Items",
    value: "0",
    sub: "Safety breach",
    color: "red",
    icon: <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />,
  },
];

const badgeStyles = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  orange: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const sourceColors = {
  POS: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  WHATSAPP: "bg-emerald-600 text-white",
  SWIGGY: "bg-orange-500 text-white",
  ZOMATO: "bg-rose-600 text-white",
};

const statusBadges = {
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40",
  CONFIRMED: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/40",
  PREPARING: "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/50",
  READY: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/40",
  CANCELLED: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40",
  PENDING: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200",
};

export default function DashboardPage() {
  const { session, applicationUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest("/api/dashboard/summary", {}, session)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [session]);

  const stats = summary
    ? [
        {
          label: "Today's Revenue",
          value: `₹${Number(summary.today_revenue || 0).toLocaleString("en-IN")}`,
          sub: `${summary.today_orders || 0} orders today`,
          color: "blue",
          icon: statIcons[0].icon,
        },
        {
          label: "Orders Today",
          value: summary.today_orders || 0,
          sub: "From active branches",
          color: "orange",
          icon: statIcons[1].icon,
        },
        {
          label: "Avg. Order Value",
          value: `₹${Number(summary.avg_order_value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
          sub: "Per completed ticket",
          color: "green",
          icon: statIcons[2].icon,
        },
        {
          label: "Low Stock Items",
          value: summary.low_stock_count || 0,
          sub: "Requires reorder",
          color: "red",
          icon: statIcons[3].icon,
        },
      ]
    : statIcons;

  const displayName = applicationUser?.name || applicationUser?.restaurant_name || "Manager";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-2xl text-ink tracking-tight">
          Executive Dashboard
        </h1>
        <p className="text-sm text-muted mt-1">
          Welcome back, <strong className="text-ink">{displayName}</strong>. Here is your live kitchen performance.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-3 " + badgeStyles[s.color]}>
              {s.icon}
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{s.label}</p>
            <p className="font-display font-extrabold text-2xl text-ink mt-1 mb-0.5">{s.value}</p>
            <p className="text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts & AI Insights Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">7-Day Revenue Trend</p>
              <p className="font-display font-extrabold text-3xl text-ink mt-0.5">
                ₹{summary ? Number(summary.total_revenue || 0).toLocaleString("en-IN") : "—"}
              </p>
            </div>
            <span className="text-xs font-medium text-muted bg-surface-2 px-2.5 py-1 rounded-lg border border-border">
              Completed Orders
            </span>
          </div>
          <RevenueChart data={summary?.revenue_series} />
        </div>

        {/* Original Light Gradient AI Copilot Insights Card */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 to-accent-2/10 p-5 flex flex-col justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-accent mb-2">✨ RASOISAATHI AI COPILOT INSIGHTS</p>
            <p className="text-sm text-ink mb-4 leading-relaxed">
              {summary?.insight ||
                "Your live operational summary is ready. Use inventory and orders to make the next service decision."}
            </p>
          </div>

          <Link
            href="/copilot"
            className="text-xs font-bold text-accent hover:underline flex items-center gap-1 mt-3"
          >
            <span>Ask the Copilot for a fix →</span>
          </Link>
        </div>
      </div>

      {/* Live Recent Orders Section */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">Live Recent Orders</h2>
            <p className="text-xs text-muted mt-0.5">Real-time incoming and completed tickets from all channels.</p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-bold text-slate-900 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <span>View all orders</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted">Loading live orders...</div>
        ) : (summary?.recent_orders || []).length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">No orders found for this restaurant yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {summary.recent_orders.map((o) => {
              const sourceBadge = sourceColors[o.source] || "bg-surface-2 text-ink";
              const statusBadge = statusBadges[o.status] || "bg-surface-2 text-muted";
              const formattedTime = new Date(o.ordered_at).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              });
              const formattedDate = new Date(o.ordered_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={o.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-surface-2 text-muted border border-border block text-center">
                        #{o.display_id || o.id.slice(0, 6)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${sourceBadge}`}>
                          {o.source}
                        </span>
                        <span className="text-xs font-semibold text-ink">
                          {o.order_type ? o.order_type.replace("_", " ") : "DINE IN"}
                        </span>
                        <span className="text-xs text-muted">·</span>
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Clock size={11} />
                          {formattedDate}, {formattedTime}
                        </span>
                      </div>

                      <p className="text-xs text-muted mt-1 font-medium line-clamp-1">
                        {o.item_summary || "Kitchen order"}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pl-11 sm:pl-0">
                    <p className="font-bold text-ink text-sm">₹{Number(o.total || 0).toLocaleString("en-IN")}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}