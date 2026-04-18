"use client";

import { motion } from "framer-motion";
import {
  GlobeAmericasIcon,
  EyeIcon,
  MapPinIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import type { Region, DecliningRegion } from "@/types";

interface Props {
  regions: Region[];
  decliningRegions: DecliningRegion[];
}

export default function StatsGrid({ regions, decliningRegions }: Props) {
  const topRegion = regions[0];
  const worstDecline = decliningRegions[0];
  const totalObs = regions.reduce((s, r) => s + r.total_observations, 0);
  const avgScore = regions.length
    ? (regions.reduce((s, r) => s + r.biodiversity_score, 0) / regions.length).toFixed(2)
    : "—";

  const cards = [
    {
      icon: GlobeAmericasIcon,
      label: "Highest Biodiversity",
      value: topRegion?.region ?? "—",
      sub: `Score: ${topRegion?.biodiversity_score ?? "—"}`,
      color: "emerald",
    },
    {
      icon: EyeIcon,
      label: "Total Observations",
      value: totalObs.toLocaleString(),
      sub: `Across ${regions.length} regions`,
      color: "cyan",
    },
    {
      icon: MapPinIcon,
      label: "Avg Biodiversity Score",
      value: avgScore,
      sub: "Shannon Diversity Index",
      color: "violet",
    },
    {
      icon: ArrowTrendingDownIcon,
      label: "Fastest Declining",
      value: worstDecline?.region ?? "—",
      sub: worstDecline ? `${worstDecline.pct_change}% change` : "—",
      color: "red",
    },
  ];

  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/20 text-red-400",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className={`rounded-2xl bg-gradient-to-br ${colorMap[card.color]} border p-5 cursor-default`}
        >
          <card.icon className="w-8 h-8 mb-3 opacity-60" />
          <div className="text-xs uppercase tracking-wider opacity-60 mb-1">{card.label}</div>
          <div className="text-2xl font-bold text-white">{card.value}</div>
          <div className="text-xs opacity-50 mt-1">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
