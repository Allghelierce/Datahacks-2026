"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import type { Region } from "@/types";

interface Props {
  regions: Region[];
  onRegionClick: (region: Region) => void;
}

const COLORS = [
  "#34d399", "#22d3ee", "#a78bfa", "#f472b6",
  "#fbbf24", "#fb923c", "#6ee7b7", "#818cf8",
  "#f87171", "#94a3b8",
];

function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill, payload, value, percent,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#fff" fontSize={18} fontWeight="bold">
        {payload.region}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={12}>
        {value} species
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={11}>
        {(percent * 100).toFixed(1)}% of total
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.9}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

export default function SpeciesDonutChart({ regions, onRegionClick }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const data = regions.map((r) => ({
    ...r,
    name: r.region,
    value: r.unique_species,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Species Distribution</h3>
        <p className="text-sm text-white/40 mt-1">Proportion of unique species by region</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-full md:w-1/2">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onClick={(_, index) => { if (regions[index]) onRegionClick(regions[index]); }}
                cursor="pointer"
                animationDuration={1200}
                animationEasing="ease-out"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full md:w-1/2 grid grid-cols-2 gap-2">
          {regions.map((r, i) => (
            <motion.button
              key={r.region}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onRegionClick(r)}
              whileHover={{ x: 4 }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                activeIndex === i ? "bg-white/5" : "hover:bg-white/[0.02]"
              }`}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/80 truncate">{r.region}</div>
                <div className="text-[10px] text-white/30">{r.unique_species} species</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
