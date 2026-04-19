"use client";

import { motion } from "framer-motion";
import {
  GlobeAmericasIcon,
  EyeIcon,
  MapPinIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
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
  const totalSpecies = regions.reduce((s, r) => s + r.unique_species, 0);
  const avgScore = regions.length
    ? (regions.reduce((s, r) => s + r.biodiversity_score, 0) / regions.length).toFixed(2)
    : "—";
  const decliningCount = decliningRegions.filter((d) => d.pct_change < 0).length;
  const growingCount = regions.length - decliningCount;

  const cards = [
    {
      icon: GlobeAmericasIcon,
      label: "Highest Biodiversity",
      value: topRegion?.region ?? "—",
      sub: `Shannon Index: ${topRegion?.biodiversity_score ?? "—"}`,
      color: "emerald",
      accent: "bg-emerald-400",
    },
    {
      icon: EyeIcon,
      label: "Total Observations",
      value: totalObs.toLocaleString(),
      sub: `${totalSpecies.toLocaleString()} unique species`,
      color: "cyan",
      accent: "bg-cyan-400",
    },
    {
      icon: BeakerIcon,
      label: "Avg Biodiversity",
      value: avgScore,
      sub: "Shannon Diversity Index",
      color: "violet",
      accent: "bg-violet-400",
    },
    {
      icon: ArrowTrendingUpIcon,
      label: "Growing Regions",
      value: `${growingCount}/${regions.length}`,
      sub: `${decliningCount} declining`,
      color: "teal",
      accent: "bg-teal-400",
    },
    {
      icon: ArrowTrendingDownIcon,
      label: "Fastest Declining",
      value: worstDecline?.region ?? "—",
      sub: worstDecline ? `${worstDecline.pct_change}% over 5 years` : "—",
      color: "red",
      accent: "bg-red-400",
    },
    {
      icon: MapPinIcon,
      label: "Most Species",
      value: topRegion?.unique_species?.toLocaleString() ?? "—",
      sub: topRegion?.region ?? "—",
      color: "amber",
      accent: "bg-amber-400",
    },
  ];

  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/15 text-emerald-400",
    cyan: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/15 text-cyan-400",
    violet: "from-violet-500/15 to-violet-500/5 border-violet-500/15 text-violet-400",
    teal: "from-teal-500/15 to-teal-500/5 border-teal-500/15 text-teal-400",
    red: "from-red-500/15 to-red-500/5 border-red-500/15 text-red-400",
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/15 text-amber-400",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.07 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className={`relative rounded-2xl bg-gradient-to-br ${colorMap[card.color]} border p-8 cursor-default overflow-hidden group`}
        >
          <div className={`absolute top-0 left-0 w-full h-[2px] ${card.accent} opacity-40`} />

          <div className="flex items-start justify-between mb-4">
            <card.icon className="w-9 h-9 opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className={`w-2 h-2 rounded-full ${card.accent} opacity-40`} />
          </div>
          <div className="text-sm uppercase tracking-[0.15em] opacity-50 mb-2">{card.label}</div>
          <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
          <div className="text-sm opacity-40">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
