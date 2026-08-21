"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { day: "Mon", revenue: 24000 },
  { day: "Tue", revenue: 28000 },
  { day: "Wed", revenue: 22000 },
  { day: "Thu", revenue: 31000 },
  { day: "Fri", revenue: 35000 },
  { day: "Sat", revenue: 42000 },
  { day: "Sun", revenue: 38000 },
];

export default function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="day" stroke="var(--muted)" style={{ fontSize: "12px" }} />
        <YAxis stroke="var(--muted)" style={{ fontSize: "12px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
          formatter={(value) => `₹${value.toLocaleString()}`}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ fill: "var(--accent)", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
