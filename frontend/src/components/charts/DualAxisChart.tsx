"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TrendPoint } from "@/types";

interface Props {
  data: TrendPoint[];
  title: string;
  subtitle?: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const parts = (label as string).split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = parts.length >= 2 ? parseInt(parts[1]) - 1 : -1;
  const formatted = monthIdx >= 0 && monthIdx < 12 ? `${monthNames[monthIdx]} ${parts[0]}` : (label as string);

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl px-5 py-4 shadow-2xl border border-white/10 min-w-[200px]">
      <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">{formatted}</p>
      <div className="space-y-2">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-white/60">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold text-white tabular-nums">
              {entry.value?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatXTick(value: string) {
  const [year, month] = value.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = parseInt(month) - 1;
  if (m === 0) return `Jan '${year.slice(2)}`;
  return monthNames[m];
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-6 mt-2">
      {payload?.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-3 h-1.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-white/40">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DualAxisChart({ data, title, subtitle }: Props) {
  const gradientId = useId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`dual-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="year_month"
            tickFormatter={formatXTick}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
            interval={2}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Legend content={<CustomLegend />} />
          <Bar
            yAxisId="right"
            dataKey="observation_count"
            fill="rgba(99,102,241,0.25)"
            radius={[3, 3, 0, 0]}
            name="Observations"
            animationDuration={1200}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="unique_species"
            stroke="#34d399"
            strokeWidth={2.5}
            fill={`url(#dual-grad-${gradientId})`}
            name="Species"
            dot={false}
            activeDot={{ r: 5, fill: "#34d399", stroke: "#0a0a0a", strokeWidth: 3 }}
            animationDuration={1500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
