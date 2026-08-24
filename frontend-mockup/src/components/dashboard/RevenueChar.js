"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const data = [
  { time: "10 AM", revenue: 0 },
  { time: "11 AM", revenue: 1800 },
  { time: "12 PM", revenue: 4200 },
  { time: "1 PM", revenue: 6800 },
  { time: "2 PM", revenue: 5200 },
  { time: "3 PM", revenue: 2100 },
  { time: "4 PM", revenue: 1900 },
  { time: "5 PM", revenue: 3400 },
  { time: "6 PM", revenue: 5600 },
  { time: "7 PM", revenue: 8200 },
  { time: "8 PM", revenue: 10800 },
  { time: "9 PM", revenue: 8900 },
  { time: "10 PM", revenue: 4600 },
  { time: "11 PM", revenue: 2100 },
];

export default function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" vertical={false} />
        <Tooltip
  contentStyle={{
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: "10px",
    color: "var(--text)",
  }}
  labelStyle={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}
  itemStyle={{ color: "var(--accent)" }}
  formatter={(value) => ["₹" + value.toLocaleString("en-IN"), "Revenue"]}
/>
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
         tick={{ fill: "var(--text)", fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
         tick={{ fill: "var(--text)", fontSize: 11 }}
          tickFormatter={(v) => "₹" + v / 1000 + "k"}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}