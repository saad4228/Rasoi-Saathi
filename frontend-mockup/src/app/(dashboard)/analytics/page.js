"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IndianRupee, Percent, Receipt, TrendingDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/services/api";

const ACCENT = "#F2660D";
const METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Gross profit" },
  { key: "orders", label: "Orders" },
];
const EMPTY = { trend: [], stats: {}, cost_breakdown: [], dishes: [], assumptions: null };
const rupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function AnalyticsPage() {
  const [range, setRange] = useState(7);
  const [metric, setMetric] = useState("revenue");
  const [sortBy, setSortBy] = useState("revenue");
  const [result, setResult] = useState({ days: null, data: EMPTY, error: "" });

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/api/analytics/summary?days=${range}`)
      .then((data) => {
        if (!cancelled) setResult({ days: range, data, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setResult({ days: range, data: EMPTY, error: error.message || "Unable to load analytics." });
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const loaded = result.days === range;
  const analytics = loaded ? result.data : EMPTY;
  const trend = useMemo(() => analytics.trend.map((row) => ({ ...row, revenue: Number(row.revenue), profit: Number(row.profit) })), [analytics.trend]);
  const sortedDishes = useMemo(
    () => [...analytics.dishes].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy])),
    [analytics.dishes, sortBy]
  );
  const costs = analytics.cost_breakdown.filter((cost) => Number(cost.value) > 0);
  const largestCost = [...costs].sort((a, b) => b.value - a.value)[0];
  const topDish = sortedDishes[0];

  const stats = [
    { label: "Revenue", value: rupees(analytics.stats.total_revenue), icon: IndianRupee },
    { label: "Completed orders", value: Number(analytics.stats.total_orders || 0).toLocaleString("en-IN"), icon: Receipt },
    { label: "Profit margin", value: `${Number(analytics.stats.profit_margin || 0).toFixed(1)}%`, icon: Percent },
    { label: "Food cost", value: `${Number(analytics.stats.food_cost_percent || 0).toFixed(1)}%`, icon: TrendingDown },
  ];

  return (
    <div className="p-2 sm:p-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Analytics</h1>
          <p className="text-sm text-muted mt-1">Completed orders across all outlets.</p>
        </div>
        <div className="flex gap-2 bg-surface-2 border border-border p-1 rounded-full">
          {[7, 30].map((days) => (
            <button
              key={days}
              onClick={() => setRange(days)}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${range === days ? "bg-surface text-ink shadow font-semibold" : "text-muted"}`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {result.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {result.error}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl p-5 bg-surface border border-border">
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-accent/10">
              <s.icon size={16} className="text-accent" />
            </div>
            <div className="text-2xl font-extrabold text-ink mt-3">{loaded ? s.value : "—"}</div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-6 bg-surface border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-sm text-ink">Performance trend</h2>
            <div className="flex gap-1 bg-surface-2 border border-border p-1 rounded-full">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${metric === m.key ? "bg-surface text-ink shadow font-semibold" : "text-muted"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="var(--text-muted)" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" }} />
              <Area type="monotone" dataKey={metric} stroke={ACCENT} strokeWidth={2} fill="url(#fill)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted">Gross profit = revenue − recipe food cost − aggregator commission.</p>
        </div>

        <div className="rounded-2xl p-6 bg-surface border border-border">
          <h2 className="font-bold text-sm text-ink mb-2">Where costs go</h2>
          {costs.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No costs recorded in this period.</p>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={costs} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={4} cornerRadius={6}>
                      {costs.map((c) => (
                        <Cell key={c.name} fill={c.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name, item) => [`${Number(v).toFixed(1)}% · ${rupees(item.payload.amount)}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-ink">{Number(largestCost?.value || 0).toFixed(0)}%</span>
                  <span className="text-[10px] text-muted">{largestCost?.name}</span>
                </div>
              </div>
              <div className="space-y-3 mt-3">
                {costs.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-2 text-muted">
                        <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-semibold text-ink">{rupees(c.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, Number(c.value)))}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-6 bg-surface border border-border overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-ink">Dish performance</h2>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs border border-border bg-surface-2 rounded-full px-3 py-1 text-ink">
              <option value="revenue">Sort by revenue</option>
              <option value="orders">Sort by quantity</option>
              <option value="margin">Sort by margin</option>
            </select>
          </div>
          {sortedDishes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No completed orders in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs">
                  <th className="pb-2 font-medium">Dish</th>
                  <th className="pb-2 font-medium">Revenue</th>
                  <th className="pb-2 font-medium">Sold</th>
                  <th className="pb-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {sortedDishes.map((d) => (
                  <tr key={d.name} className="border-t border-border">
                    <td className="py-2.5 font-medium">{d.name}</td>
                    <td className="py-2.5">{rupees(d.revenue)}</td>
                    <td className="py-2.5">{d.orders}</td>
                    <td className="py-2.5">
                      <span className={`font-semibold ${d.margin >= 35 ? "text-green-600 dark:text-green-400" : "text-orange-500"}`}>{Number(d.margin || 0).toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl p-6 border border-border bg-gradient-to-br from-accent/10 to-accent-2/10">
          <h2 className="font-bold text-sm text-ink mb-2">Summary</h2>
          <p className="text-sm text-ink leading-relaxed">
            {topDish
              ? `${topDish.name} leads by ${sortBy === "orders" ? "quantity sold" : sortBy === "margin" ? "margin" : "revenue"}. Food cost is ${Number(analytics.stats.food_cost_percent || 0).toFixed(1)}% of revenue across ${Number(analytics.stats.total_orders || 0)} completed orders.`
              : "Complete some orders to see a profitability summary."}
          </p>
          {analytics.assumptions && (
            <p className="text-xs text-muted mt-3">
              Assumes {analytics.assumptions.aggregator_commission_percent}% aggregator commission; excludes {analytics.assumptions.excludes}.
            </p>
          )}
          <Link href="/copilot" className="inline-block text-sm font-semibold mt-4 text-accent hover:underline">
            Ask the Copilot for ideas →
          </Link>
        </div>
      </div>
    </div>
  );
}
