"use client";

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, ArrowUp, ArrowDown } from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const ACCENT = "#F2660D";
const INK = "#1A1512";

// TODO(backend): replace with real fetched data, keyed by range
const TREND_BY_RANGE = {
  "7d": [
    { label: "Mon", revenue: 22000, profit: 6200, orders: 68 },
    { label: "Tue", revenue: 25400, profit: 7100, orders: 74 },
    { label: "Wed", revenue: 21100, profit: 5300, orders: 61 },
    { label: "Thu", revenue: 28600, profit: 8400, orders: 82 },
    { label: "Fri", revenue: 31200, profit: 9600, orders: 91 },
    { label: "Sat", revenue: 34500, profit: 10800, orders: 104 },
    { label: "Sun", revenue: 29400, profit: 8900, orders: 88 },
  ],
  "30d": Array.from({ length: 30 }, (_, i) => ({
    label: `${i + 1}`,
    revenue: 18000 + Math.round(Math.sin(i / 3) * 6000 + i * 300),
    profit: 5000 + Math.round(Math.sin(i / 3) * 1800 + i * 90),
    orders: 55 + Math.round(Math.sin(i / 4) * 15 + i * 0.8),
  })),
};

const COST_BREAKDOWN = [
  { name: "Food Cost", value: 42, color: ACCENT },
  { name: "Platform Fees", value: 18, color: "#F0A93A" },
  { name: "Wastage", value: 8, color: "#C9500A" },
  { name: "Other Costs", value: 32, color: "#E7DFD1" },
];

const DISHES = [
  { name: "Chicken Biryani", revenue: 42000, orders: 210, margin: 31 },
  { name: "Paneer Roll", revenue: 18500, orders: 260, margin: 44 },
  { name: "Veg Thali", revenue: 15200, orders: 95, margin: 22 },
  { name: "Iced Latte", revenue: 9800, orders: 180, margin: 58 },
];

const STATS = [
  { label: "Total Revenue", value: "₹1,92,200", change: "+12%", icon: DollarSign, up: true },
  { label: "Total Orders", value: "612", change: "+6%", icon: TrendingUp, up: true },
  { label: "Profit Margin", value: "27.4%", change: "-2.1%", icon: Percent, up: false },
  { label: "Food Cost %", value: "34%", change: "+3%", icon: TrendingDown, up: false },
];

const METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "orders", label: "Orders" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("7d");
  const [metric, setMetric] = useState("revenue");
  const [sortBy, setSortBy] = useState("revenue");

  const trend = TREND_BY_RANGE[range];
  const sortedDishes = useMemo(
    () => [...DISHES].sort((a, b) => b[sortBy] - a[sortBy]),
    [sortBy]
  );

  return (
    <div className="p-8">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: INK }}>AI Analytics</h1>
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

      {/* stat cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {STATS.map((s) => (
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
          data={COST_BREAKDOWN}
          dataKey="value"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={4}
          cornerRadius={6}
          label={({ value }) => `${value}%`}
          labelLine={false}
        >
          {COST_BREAKDOWN.map((c) => <Cell key={c.name} fill={c.color} stroke="none" />)}
        </Pie>
        <Tooltip formatter={(v) => `${v}%`} />
      </PieChart>
    </ResponsiveContainer>
    {/* center label */}
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <span className="text-2xl font-extrabold">42%</span>
      <span className="text-[10px] text-gray-400">largest cost</span>
    </div>
  </div>

  <div className="space-y-3 mt-3">
    {COST_BREAKDOWN.map((c) => (
      <div key={c.name}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
          <span className="font-semibold">{c.value}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${c.value}%`, background: c.color }}
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
                      {d.margin}%
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
          {/* TODO(backend): replace with real generated insight */}
          <p className="text-sm text-gray-700 leading-relaxed">
            Profit margin dropped 2.1% this week — mainly rising food costs
            on Chicken Biryani and fewer high-margin drink orders. A small
            price adjustment or a combo offer could recover the margin.
          </p>
          <button className="text-sm font-semibold mt-4" style={{ color: ACCENT }}>
            Ask the Copilot for a fix →
          </button>
        </div>
      </div>
    </div>
  );
}
