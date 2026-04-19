"use client";

import { motion } from "framer-motion";
import {
  ShieldExclamationIcon,
  EyeIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  GlobeAmericasIcon,
} from "@heroicons/react/24/outline";
import { useAppData } from "@/context/DataContext";

export default function GlobalStats() {
  const { data, loading } = useAppData();
  
  if (loading || !data) {
    return <div className="grid grid-cols-3 gap-4 h-48 animate-pulse bg-white/[0.02] rounded-2xl" />;
  }

  const ZONE_DATA = data.zones;
  const GLOBAL_STATS = data.global_stats;
  const healthyZones = ZONE_DATA.filter((z) => z.health.grade === "B").length;
  const criticalZones = ZONE_DATA.filter((z) => z.health.grade === "D" || z.health.grade === "F").length;

  const cards = [
    {
      icon: ShieldExclamationIcon,
      label: "Threatened Species",
      value: GLOBAL_STATS.totalSpecies.toLocaleString(),
      sub: "Tracked across San Diego County",
      color: "emerald",
      accent: "bg-emerald-400",
    },
    {
      icon: EyeIcon,
      label: "Observations",
      value: GLOBAL_STATS.totalObservations.toLocaleString(),
      sub: "Research-grade verified",
      color: "cyan",
      accent: "bg-cyan-400",
    },
    {
      icon: MapPinIcon,
      label: "Monitored Zones",
      value: String(GLOBAL_STATS.totalZones),
      sub: `${healthyZones} healthy, ${criticalZones} critical`,
      color: "violet",
      accent: "bg-violet-400",
    },
    {
      icon: ExclamationTriangleIcon,
      label: "Zones at Risk",
      value: String(GLOBAL_STATS.zonesAtRisk),
      sub: "Showing collapse indicators",
      color: "red",
      accent: "bg-red-400",
    },
    {
      icon: BeakerIcon,
      label: "Trophic Levels",
      value: String(Object.keys(GLOBAL_STATS.trophicBreakdown).length),
      sub: "Food web depth tracked",
      color: "amber",
      accent: "bg-amber-400",
    },
    {
      icon: GlobeAmericasIcon,
      label: "Data Source",
      value: "iNaturalist",
      sub: "Citizen science observations",
      color: "teal",
      accent: "bg-teal-400",
    },
  ];

  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/15 text-emerald-400",
    cyan: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/15 text-cyan-400",
    violet: "from-violet-500/15 to-violet-500/5 border-violet-500/15 text-violet-400",
    red: "from-red-500/15 to-red-500/5 border-red-500/15 text-red-400",
    amber: "from-amber-500/15 to-amber-500/5 border-amber-500/15 text-amber-400",
    teal: "from-teal-500/15 to-teal-500/5 border-teal-500/15 text-teal-400",
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
          <div className="text-[10px] uppercase tracking-[0.15em] opacity-50 mb-1">{card.label}</div>
          <div className="text-2xl font-bold text-white mb-0.5">{card.value}</div>
          <div className="text-xs opacity-40">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
