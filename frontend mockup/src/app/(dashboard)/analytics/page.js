"use client";

import { useEffect, useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, ArrowUp, ArrowDown } from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/api";

const ACCENT = "#F2660D";
const INK = "#1A1512";

const METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "orders", label: "Orders" },
];

export default function AnalyticsPage() {
  const { session } = useAuth();
  const [range, setRange] = useState("7d");
  const [metric, setMetric] = useState("revenue");
  const [sortBy, setSortBy] = useState("revenue");
  const [analytics, setAnalytics] = useState({ trend: [], stats: {}, cost_breakdown: [], dishes: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/api/analytics/summary?days=${range === "7d" ? 7 : 30}`, {}, session)
      .then(setAnalytics)
      .catch((loadError) => setError(loadError.message || "Unable to load analytics."));
  }, [range, session]);

  const trend = analytics.trend;
  const sortedDishes = useMemo(
    () => [...analytics.dishes].sort((a, b) => b[sortBy] - a[sortBy]),
    [analytics.dishes, sortBy]
  );
  const topDish = sortedDishes[0];
  const stats = [
    { label: "Total Revenue", value: `₹${Number(analytics.stats.total_revenue || 0).toLocaleString("en-IN")}`, change: "Live", icon: DollarSign, up: true },
    { label: "Total Orders", value: Number(analytics.stats.total_orders || 0).toLocaleString("en-IN"), change: "Live", icon: TrendingUp, up: true },
    { label: "Profit Margin", value: `${Number(analytics.stats.profit_margin || 0).toFixed(1)}%`, change: "Live", icon: Percent, up: true },
    { label: "Food Cost %", value: `${Number(analytics.stats.food_cost_percent || 0).toFixed(1)}%`, change: "Live", icon: TrendingDown, up: false },
  ];

  return (
    <div className="p-8">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: INK }}>Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Sales trends and profitability, in one view.</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-full">
          {["7d", "30d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                range === r ? "bg-white shadow font-semibold" : "text-gray-500"
              }`}
            >
              {r === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* stat cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl p-5 bg-white border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#FDEDE1" }}>
                <s.icon size={16} style={{ color: ACCENT }} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold ${s.up ? "text-green-600" : "text-red-500"}`}>
                {s.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {s.change}
              </span>
            </div>
            <div className="text-2xl font-extrabold mt-3">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* main trend chart, spans 2 cols */}
        <div className="col-span-2 rounded-2xl p-6 bg-white border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">Performance Trend</h2>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-full">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    metric === m.key ? "bg-white shadow font-semibold" : "text-gray-500"
                  }`}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey={metric} stroke={ACCENT} strokeWidth={2} fill="url(#fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* cost breakdown donut */}
        {/* cost breakdown donut */}
<div className="rounded-2xl p-6 bg-white border shadow-sm">
  <h2 className="font-bold text-sm mb-2">Where Profit Goes</h2>
  <div className="relative">
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={analytics.cost_breakdown}
          dataKey="value"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={4}
          cornerRadius={6}
          label={({ value }) => `${Number(value || 0).toFixed(1)}%`}
          labelLine={false}
        >
          {analytics.cost_breakdown.map((c) => <Cell key={c.name} fill={c.color} stroke="none" />)}
        </Pie>
        <Tooltip formatter={(v) => `${Number(v || 0).toFixed(1)}%`} />
      </PieChart>
    </ResponsiveContainer>
    {/* center label */}
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <span className="text-2xl font-extrabold">{Number(analytics.cost_breakdown[0]?.value || 0).toFixed(1)}%</span>
      <span className="text-[10px] text-gray-400">largest cost</span>
    </div>
  </div>

  <div className="space-y-3 mt-3">
    {analytics.cost_breakdown.map((c) => (
      <div key={c.name}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
          <span className="font-semibold">{Number(c.value || 0).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, Number(c.value || 0)))}%`, background: c.color }}
          />
        </div>
      </div>
    ))}
  </div>
  </div>
</div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* dish performance table */}
        <div className="col-span-2 rounded-2xl p-6 bg-white border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">Dish Performance</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border rounded-full px-3 py-1 text-gray-600"
            >
              <option value="revenue">Sort by revenue</option>
              <option value="orders">Sort by orders</option>
              <option value="margin">Sort by margin</option>
            </select>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs">
                <th className="pb-2 font-medium">Dish</th>
                <th className="pb-2 font-medium">Revenue</th>
                <th className="pb-2 font-medium">Orders</th>
                <th className="pb-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {sortedDishes.map((d) => (
                <tr key={d.name} className="border-t">
                  <td className="py-2.5 font-medium">{d.name}</td>
                  <td className="py-2.5">₹{d.revenue.toLocaleString("en-IN")}</td>
                  <td className="py-2.5">{d.orders}</td>
                  <td className="py-2.5">
                    <span className={`font-semibold ${d.margin >= 35 ? "text-green-600" : "text-orange-500"}`}>
                      {Number(d.margin || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI insight */}
        <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #FDEDE1, #FFF8F0)" }}>
          <h2 className="font-bold text-sm mb-2">✨ Copilot Insight</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {topDish
              ? `${topDish.name} is your top dish by ${sortBy === "orders" ? "orders" : "revenue"} in this period. Food cost is ${Number(analytics.stats.food_cost_percent || 0).toFixed(1)}% of revenue across ${Number(analytics.stats.total_orders || 0)} completed orders.`
              : "Complete orders to generate a live profitability insight."}
          </p>
          <button className="text-sm font-semibold mt-4" style={{ color: ACCENT }}>
            Ask the Copilot for a fix →
          </button>
        </div>
      </div>
    </div>
  );
}
