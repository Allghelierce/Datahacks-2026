"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KEYSTONE_RANKINGS,
  ZONE_KEYSTONE_RANKINGS,
  ZONE_DATA,
  DEPENDENCY_NODES,
  type ZoneKeystoneEntry,
} from "@/lib/speciesData";

type GlobalEntry = (typeof KEYSTONE_RANKINGS)[number];

const TROPHIC_COLORS: Record<string, string> = {
  producer: "text-emerald-400",
  pollinator: "text-pink-400",
  primary_consumer: "text-amber-400",
  secondary_consumer: "text-cyan-400",
  tertiary_consumer: "text-indigo-400",
  apex_predator: "text-red-400",
  decomposer: "text-violet-400",
};

const TROPHIC_BG: Record<string, string> = {
  producer: "bg-emerald-400/10 border-emerald-400/20",
  pollinator: "bg-pink-400/10 border-pink-400/20",
  primary_consumer: "bg-amber-400/10 border-amber-400/20",
  secondary_consumer: "bg-cyan-400/10 border-cyan-400/20",
  tertiary_consumer: "bg-indigo-400/10 border-indigo-400/20",
  apex_predator: "bg-red-400/10 border-red-400/20",
  decomposer: "bg-violet-400/10 border-violet-400/20",
};

interface NormalizedEntry {
  id: string;
  common_name: string;
  trophic_level: string;
  cascadeImpactPct: number;
  speciesLost: number;
  victimNames: string[];
  trophicLevelsAffected: number;
  declineTrend: number;
  priority: string;
}

function normalizeGlobal(e: GlobalEntry): NormalizedEntry {
  return {
    id: e.id,
    common_name: e.common_name,
    trophic_level: e.trophic_level,
    cascadeImpactPct: e.keystone_score * 100,
    speciesLost: e.cascade_victims.length,
    victimNames: [...e.cascade_victim_names],
    trophicLevelsAffected: e.trophic_levels_affected,
    declineTrend: e.decline_trend,
    priority: e.priority,
  };
}

function normalizeZone(e: ZoneKeystoneEntry, totalSpeciesInZone: number): NormalizedEntry {
  return {
    id: e.id,
    common_name: e.common_name,
    trophic_level: e.trophic_level,
    cascadeImpactPct: e.zone_keystone_score * 100,
    speciesLost: e.cascade_victim_count,
    victimNames: [...e.cascade_victim_names],
    trophicLevelsAffected: e.trophic_levels_affected,
    declineTrend: e.decline_trend,
    priority: e.priority,
  };
}

export default function ConservationReport() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const selectedZone = selectedZoneId
    ? ZONE_DATA.find((z) => z.id === selectedZoneId)
    : null;

  const rankings: NormalizedEntry[] = useMemo(() => {
    if (selectedZoneId && ZONE_KEYSTONE_RANKINGS[selectedZoneId]) {
      const zone = ZONE_DATA.find((z) => z.id === selectedZoneId);
      const totalSpecies = zone?.total_species ?? DEPENDENCY_NODES.length;
      return ZONE_KEYSTONE_RANKINGS[selectedZoneId].map((e) =>
        normalizeZone(e, totalSpecies)
      );
    }
    return KEYSTONE_RANKINGS.map(normalizeGlobal);
  }, [selectedZoneId]);

  const top5 = rankings.slice(0, 5);
  const criticalSpecies = rankings.filter((s) => s.priority === "critical" || (s.priority === "high" && s.declineTrend < -20));

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
          <h3 className="text-lg font-semibold">Conservation Priority Report</h3>
          <p className="text-sm text-white/40 mt-1">
            Species ranked by cascade impact — those the ecosystem can&apos;t afford to lose
          </p>
        </div>
        <select
          value={selectedZoneId ?? ""}
          onChange={(e) => setSelectedZoneId(e.target.value || null)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-white/20 min-w-[180px]"
        >
          <option value="">All Zones (Global)</option>
          {ZONE_DATA.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      {criticalSpecies.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-500/5 border border-red-500/15 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-semibold text-red-400">
              Risk Assessment — {criticalSpecies.length} Critical Priority
              {criticalSpecies.length !== 1 ? " Species" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {criticalSpecies.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/20">
                  Critical
                </span>
                <span className="text-white/70">
                  Loss of{" "}
                  <span className="text-white font-medium">{s.common_name || s.id}</span>
                  {" "}would collapse{" "}
                  <span className="text-red-300 font-medium">{s.speciesLost} species</span>
                  {" "}across{" "}
                  <span className="text-red-300 font-medium">
                    {s.trophicLevelsAffected} trophic level{s.trophicLevelsAffected !== 1 ? "s" : ""}
                  </span>
                  {s.declineTrend < 0 && (
                    <span className="text-red-400">
                      {" "}— already declining {Math.abs(s.declineTrend).toFixed(0)}% YoY
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/30 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="pb-3 pr-4 w-8">#</th>
              <th className="pb-3 pr-4">Species</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4 text-right">Cascade Impact</th>
              <th className="pb-3 pr-4 text-right">Species Lost</th>
              <th className="pb-3 pr-4 text-right">Levels Hit</th>
              <th className="pb-3 pr-4 text-right">Trend</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {top5.map((entry, i) => {
                const isCritical = entry.priority === "critical" || (entry.priority === "high" && entry.declineTrend < -20);
                return (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition"
                  >
                    <td className="py-3 pr-4 text-white/20 font-mono">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <div>
                        <span className="text-white font-medium">{entry.common_name || entry.id}</span>
                        {entry.common_name && (
                          <span className="block text-[11px] text-white/30 italic">{entry.id}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium capitalize border ${
                          TROPHIC_BG[entry.trophic_level] ?? "bg-white/5 border-white/10"
                        } ${TROPHIC_COLORS[entry.trophic_level] ?? "text-white/50"}`}
                      >
                        {entry.trophic_level.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={`font-mono font-semibold ${
                          entry.cascadeImpactPct >= 5
                            ? "text-red-400"
                            : entry.cascadeImpactPct >= 2
                            ? "text-orange-400"
                            : "text-amber-400"
                        }`}
                      >
                        {entry.cascadeImpactPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-white/60 font-mono">
                      {entry.speciesLost}
                    </td>
                    <td className="py-3 pr-4 text-right text-white/60 font-mono">
                      {entry.trophicLevelsAffected}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={`font-mono text-xs ${
                          entry.declineTrend < 0 ? "text-red-400" : entry.declineTrend > 0 ? "text-emerald-400" : "text-white/20"
                        }`}
                      >
                        {entry.declineTrend > 0 ? "+" : ""}
                        {entry.declineTrend.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          Critical
                        </span>
                      ) : entry.priority === "high" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-orange-500/15 text-orange-300 border border-orange-500/15">
                          Keystone
                        </span>
                      ) : entry.priority === "medium" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-amber-500/10 text-amber-300/60 border border-amber-500/10">
                          Monitor
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {top5.length > 0 && (
        <div className="mt-6 space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-white/30 mb-3">
            Impact Narratives
          </h4>
          {top5.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 text-sm text-white/50"
            >
              <span className="text-white/15 mt-0.5">›</span>
              <span>
                Loss of{" "}
                <span className={`font-medium ${TROPHIC_COLORS[entry.trophic_level] ?? "text-white"}`}>
                  {entry.common_name || entry.id}
                </span>
                {" "}would collapse{" "}
                <span className="text-white/80 font-medium">
                  {entry.speciesLost} species
                </span>
                {entry.victimNames.length > 0 && (
                  <span className="text-white/40">
                    {" "}({entry.victimNames.slice(0, 3).join(", ")}
                    {entry.victimNames.length > 3 ? `, +${entry.victimNames.length - 3} more` : ""})
                  </span>
                )}
                {" "}across{" "}
                <span className="text-white/80 font-medium">
                  {entry.trophicLevelsAffected} trophic level{entry.trophicLevelsAffected !== 1 ? "s" : ""}
                </span>
                {" "}— {entry.cascadeImpactPct.toFixed(1)}% of{" "}
                {selectedZone ? selectedZone.name + "'s" : "the"} ecosystem.
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-white/20 text-right">
        {rankings.length} species analyzed
        {selectedZone ? ` in ${selectedZone.name}` : " globally"}
        {" · "}
        {criticalSpecies.length} critical priority
      </div>
    </motion.div>
  );
}
