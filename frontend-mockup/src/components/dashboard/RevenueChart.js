"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function RevenueChart({ data }) {
  if (!data?.length) {
    return <div className="h-[300px] grid place-items-center text-sm text-muted">No revenue data yet.</div>;
  }
  const chartData = data.map((item) => ({ ...item, revenue: Number(item.revenue || 0) }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
        <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
          }}
          formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
        />
        <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
