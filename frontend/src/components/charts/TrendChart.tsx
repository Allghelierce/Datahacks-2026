"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TrendPoint, MonthlyTrend } from "@/types";

interface Props {
  data: TrendPoint[] | MonthlyTrend[];
  title: string;
  dataKey?: string;
}

export default function TrendChart({ data, title, dataKey = "unique_species" }: Props) {
  const displayKey = dataKey === "unique_species" ? "total_unique_species" in (data[0] || {}) ? "total_unique_species" : "unique_species" : dataKey;

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="year_month"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={displayKey}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Unique Species"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
