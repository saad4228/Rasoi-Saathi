"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";
import { Receipt, TrendingUp, AlertTriangle, ArrowRight, Store, Clock } from "lucide-react";

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

const rupees = (value, options) => `₹${Number(value || 0).toLocaleString("en-IN", options)}`;

export default function DashboardPage() {
  const { applicationUser } = useAuth();
  const [result, setResult] = useState({ loaded: false, summary: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/dashboard/summary")
      .then((summary) => {
        if (!cancelled) setResult({ loaded: true, summary, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setResult({ loaded: true, summary: null, error: error.message || "Unable to load the dashboard." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { loaded, summary, error } = result;
  const show = (value) => (summary ? value : "—");
  const stats = [
    { label: "Today's Revenue", value: show(rupees(summary?.today_revenue)), sub: show(`${summary?.today_completed_orders} completed orders`), color: "blue", Icon: TrendingUp },
    { label: "Orders Today", value: show(summary?.today_orders), sub: show(`${summary?.open_orders} open in the kitchen`), color: "orange", Icon: Receipt },
    { label: "Avg. Order Value", value: show(rupees(summary?.avg_order_value, { maximumFractionDigits: 0 })), sub: "Per completed order", color: "green", Icon: Store },
    { label: "Low Stock Items", value: show(summary?.low_stock_count), sub: "At or below safety stock", color: "red", Icon: AlertTriangle },
  ];

  const displayName = applicationUser?.name || applicationUser?.restaurant_name || "Manager";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-ink tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Welcome back, <strong className="text-ink">{displayName}</strong>. Figures cover all outlets.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-3 " + badgeStyles[color]}>
              <Icon size={20} />
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
            <p className="font-display font-extrabold text-2xl text-ink mt-1 mb-0.5">{value}</p>
            <p className="text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">7-Day Revenue</p>
              <p className="font-display font-extrabold text-3xl text-ink mt-0.5">{show(rupees(summary?.total_revenue))}</p>
            </div>
            <span className="text-xs font-medium text-muted bg-surface-2 px-2.5 py-1 rounded-lg border border-border">Completed orders</span>
          </div>
          <RevenueChart data={summary?.revenue_series} />
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 to-accent-2/10 p-5 flex flex-col justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-accent mb-2">TODAY AT A GLANCE</p>
            <p className="text-sm text-ink mb-4 leading-relaxed">{loaded ? summary?.insight || "No summary available right now." : "Loading..."}</p>
          </div>
          <Link href="/copilot" className="text-xs font-bold text-accent hover:underline flex items-center gap-1 mt-3">
            Ask the Copilot what to do next →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-lg text-ink">Recent Orders</h2>
            <p className="text-xs text-muted mt-0.5">The latest tickets from every channel and outlet.</p>
          </div>
          <Link href="/orders" className="text-xs font-bold text-slate-900 dark:text-amber-400 hover:underline flex items-center gap-1">
            <span>Open live orders</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {!loaded ? (
          <div className="py-8 text-center text-xs text-muted">Loading orders...</div>
        ) : (summary?.recent_orders || []).length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">No orders yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {summary.recent_orders.map((o) => (
              <div key={o.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 px-2 rounded-xl transition-colors">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs font-bold px-2 py-1 rounded-md bg-surface-2 text-muted border border-border">#{o.display_id}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${sourceColors[o.source] || "bg-surface-2 text-ink"}`}>{o.source}</span>
                      <span className="text-xs font-semibold text-ink">{o.order_type?.replace("_", " ")}</span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(o.ordered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                      {o.branch_name && <span className="text-xs text-muted">· {o.branch_name}</span>}
                    </div>
                    <p className="text-xs text-muted mt-1 font-medium line-clamp-1">{o.item_summary || "No items"}</p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 pl-11 sm:pl-0">
                  <p className="font-bold text-ink text-sm">{rupees(o.total)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadges[o.status] || "bg-surface-2 text-muted"}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
