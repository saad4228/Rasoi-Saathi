"use client";

import { useEffect, useState } from "react";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const statIcons = [
  {
    label: "Today's Revenue",
    value: "₹18,420",
    sub: "+12% vs yesterday",
    color: "blue",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    label: "Orders Today",
    value: "84",
    sub: "+6% vs yesterday",
    color: "orange",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2l1.5 4M18 2l-1.5 4M4 6h16l-1.5 12.5a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 6z" />
      </svg>
    ),
  },
  {
    label: "Avg. Order Value",
    value: "₹219",
    sub: "-3% vs yesterday",
    color: "green",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Low Stock Items",
    value: "3",
    sub: "Needs attention",
    color: "red",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 17h.01M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      </svg>
    ),
  },
];

const badgeStyles = {
  blue: "bg-blue-500/10 text-blue-500",
  orange: "bg-orange-500/10 text-orange-500",
  green: "bg-green-500/10 text-green-500",
  red: "bg-red-500/10 text-red-500",
};

export default function DashboardPage() {
  const { session, applicationUser } = useAuth();
  const [summary, setSummary] = useState(null);
  useEffect(() => { apiRequest("/api/dashboard/summary", {}, session).then(setSummary).catch(() => setSummary(null)); }, [session]);
  const stats = summary ? [
    { label: "Today's Revenue", value: `₹${Number(summary.today_revenue).toLocaleString("en-IN")}`, sub: `${summary.today_orders} orders today`, color: "blue", icon: statIcons[0].icon },
    { label: "Orders Today", value: summary.today_orders, sub: "From all active branches", color: "orange", icon: statIcons[1].icon },
    { label: "Avg. Order Value", value: `₹${Number(summary.avg_order_value).toLocaleString("en-IN")}`, sub: "Today", color: "green", icon: statIcons[2].icon },
    { label: "Low Stock Items", value: summary.low_stock_count, sub: "Needs attention", color: "red", icon: statIcons[3].icon },
  ] : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-ink">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Welcome back, {applicationUser?.name}!</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-5">
            <div className={"w-9 h-9 rounded-xl flex items-center justify-center mb-4 " + badgeStyles[s.color]}>
              {s.icon}
            </div>
            <p className="text-xs text-muted mb-1">{s.label}</p>
            <p className="font-display font-extrabold text-2xl text-ink mb-1">{s.value}</p>
            <p className="text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-muted mb-1">TOTAL REVENUE</p>
              <p className="font-display font-extrabold text-3xl text-ink">₹{summary ? Number(summary.total_revenue).toLocaleString("en-IN") : "—"}</p>
            </div>
            <span className="text-xs text-muted">Last 7 days</span>
          </div>
          <RevenueChart />
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 to-accent-2/10 p-5">
          <p className="text-xs font-bold text-accent mb-2">✨ RASOISAATHI AI COPILOT INSIGHTS</p>
          <p className="text-sm text-ink mb-4">
            {summary?.insight || "Your live operational summary is ready. Use inventory and orders to make the next service decision."}
          </p>
          <button className="text-xs font-bold text-accent hover:underline">
            Ask the Copilot for a fix →
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display font-bold text-ink mb-4">Recent Orders</h2>
        <div className="space-y-2">
          {(summary?.recent_orders || []).map((o) => (
            <div
              key={o.id}
              className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2 text-sm"
            >
              <span className="text-ink font-medium">{o.source} · ₹{Number(o.total).toLocaleString("en-IN")}</span>
              <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-full">
                {o.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}