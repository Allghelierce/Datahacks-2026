"use client";

import { useMemo, useId } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { TrendPoint, MonthlyTrend } from "@/types";

interface Props {
  data: TrendPoint[] | MonthlyTrend[];
  title: string;
  subtitle?: string;
  dataKey?: string;
  color?: string;
  showAverage?: boolean;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const date = label as string;
  const parts = date.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = parts.length >= 2 ? parseInt(parts[1]) - 1 : -1;
  const formatted = monthIdx >= 0 && monthIdx < 12 ? `${monthNames[monthIdx]} ${parts[0]}` : date;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl px-5 py-4 shadow-2xl border border-white/10 min-w-[180px]">
      <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">{formatted}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-white/60">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold text-white">{entry.value?.toLocaleString()}</span>
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

export default function TrendChart({
  data,
  title,
  subtitle,
  dataKey = "unique_species",
  color = "#34d399",
  showAverage = true,
  height = 320,
}: Props) {
  const gradientId = useId();

  const displayKey = useMemo(() => {
    if (dataKey === "unique_species" && data[0] && "total_unique_species" in data[0]) {
      return "total_unique_species";
    }
    return dataKey;
  }, [dataKey, data]);

  const average = useMemo(() => {
    if (!showAverage || !data.length) return null;
    const vals = data.map((d: any) => d[displayKey]).filter(Boolean);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  }, [data, displayKey, showAverage]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const vals = data.map((d: any) => d[displayKey]).filter(Boolean);
    if (!vals.length) return null;
    const first = vals[0];
    const last = vals[vals.length - 1];
    const change = last - first;
    const pctChange = first ? ((change / first) * 100).toFixed(1) : "0";
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    return { first, last, change, pctChange, max, min };
  }, [data, displayKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
        </div>

        {stats && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-white/30 uppercase tracking-wider">Period Change</div>
              <div className={`text-sm font-bold ${stats.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.change >= 0 ? "+" : ""}{stats.change.toLocaleString()} ({stats.change >= 0 ? "+" : ""}{stats.pctChange}%)
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <div className="text-xs text-white/30 uppercase tracking-wider">Range</div>
              <div className="text-sm font-medium text-white/60">
                {stats.min.toLocaleString()} – {stats.max.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`area-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="50%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
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
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            dx={-5}
            width={45}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          {average && (
            <ReferenceLine
              y={average}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="6 4"
              label={{
                value: `avg: ${average.toLocaleString()}`,
                position: "insideTopRight",
                fill: "rgba(255,255,255,0.25)",
                fontSize: 10,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={displayKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#area-grad-${gradientId})`}
            name="Unique Species"
            dot={false}
            activeDot={{
              r: 5,
              fill: color,
              stroke: "#0a0a0a",
              strokeWidth: 3,
            }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
