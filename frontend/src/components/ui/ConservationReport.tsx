"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppData } from "@/context/DataContext";
import { ECOSYSTEM_INDEX } from "@/lib/speciesData";

type GlobalEntry = any;
interface ZoneKeystoneEntry {
  id: string;
  common_name: string;
  trophic_level: string;
  zone_keystone_score: number;
  decline_trend: number;
  cascade_victim_count: number;
  cascade_victim_names: string[];
  trophic_levels_affected: number;
  priority: string;
}

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

interface Props {
  ecosystem?: string | null;
}

export default function ConservationReport({ ecosystem }: Props) {
  const { data, loading } = useAppData();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const ZONE_DATA = data?.zones ?? [];
  const KEYSTONE_RANKINGS = data?.keystone_rankings ?? [];
  const ZONE_KEYSTONE_RANKINGS = data?.zone_keystone_rankings ?? {};

  const filteredZones = useMemo(() => {
    if (!ecosystem || !ECOSYSTEM_INDEX[ecosystem]) return ZONE_DATA;
    const zoneIds = new Set(ECOSYSTEM_INDEX[ecosystem].zones.map((z) => z.id));
    return ZONE_DATA.filter((z: any) => zoneIds.has(z.id));
  }, [ecosystem, ZONE_DATA]);

  useEffect(() => {
    if (filteredZones.length > 0 && !filteredZones.find((z: any) => z.id === selectedZoneId)) {
      setSelectedZoneId(filteredZones[0].id);
    }
  }, [filteredZones]);

  const rankings: NormalizedEntry[] = useMemo(() => {
    if (!data) return [];
    if (selectedZoneId && ZONE_KEYSTONE_RANKINGS[selectedZoneId]) {
      const zone = ZONE_DATA.find((z: any) => z.id === selectedZoneId);
      const totalSpecies = zone?.total_species ?? data.nodes.length;
      return ZONE_KEYSTONE_RANKINGS[selectedZoneId].map((e: ZoneKeystoneEntry) =>
        normalizeZone(e, totalSpecies)
      );
    }
    return KEYSTONE_RANKINGS.map(normalizeGlobal);
  }, [selectedZoneId, data]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/[0.02] rounded-lg" />
        ))}
      </div>
    );
  }

  const top5 = rankings.slice(0, 5);
  const criticalSpecies = rankings.filter((s) => s.priority === "critical" || (s.priority === "high" && s.declineTrend < -20));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select
          value={selectedZoneId ?? ""}
          onChange={(e) => setSelectedZoneId(e.target.value || null)}
          className="bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-emerald-500/20 min-w-[160px] font-mono"
        >
          <option value="">All zones</option>
          {filteredZones.map((z: any) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      {criticalSpecies.length > 0 && (
        <div className="mb-4 border border-red-500/10 p-4">
          <div className="text-xs text-red-400/60 uppercase tracking-widest font-mono mb-3">
            {criticalSpecies.length} critical
          </div>
          <div className="space-y-2">
            {criticalSpecies.slice(0, 3).map((s) => (
              <div key={s.id} className="text-sm text-white/60">
                <span className="text-white/80">{s.common_name || s.id}</span>
                {" "}&mdash; {s.speciesLost} species, {s.trophicLevelsAffected} levels
                {s.declineTrend < 0 && (
                  <span className="text-red-400/50 font-mono"> {Math.abs(s.declineTrend).toFixed(0)}%&darr;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase tracking-widest border-b border-white/[0.06] font-mono">
              <th className="pb-2 pr-4 w-6">#</th>
              <th className="pb-2 pr-4">Species</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4 text-right">Impact</th>
              <th className="pb-2 pr-4 text-right">Lost</th>
              <th className="pb-2 pr-4 text-right">Trend</th>
              <th className="pb-2 text-right">Status</th>
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
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition"
                  >
                    <td className="py-3 pr-4 text-white/30 font-mono text-xs">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <span className="text-white/80 text-base">{entry.common_name || entry.id}</span>
                      {entry.common_name && (
                        <span className="block text-xs text-white/35 italic font-mono">{entry.id}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-white/50 font-mono capitalize">
                        {entry.trophic_level.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-mono text-xs ${entry.cascadeImpactPct >= 5 ? "text-white/80" : "text-white/50"}`}>
                        {entry.cascadeImpactPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-white/50 font-mono text-xs">
                      {entry.speciesLost}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-mono text-xs ${entry.declineTrend < 0 ? "text-red-400/60" : "text-white/40"}`}>
                        {entry.declineTrend > 0 ? "+" : ""}{entry.declineTrend.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {isCritical ? (
                        <span className="text-xs text-red-400/60 font-mono uppercase tracking-widest">crit</span>
                      ) : entry.priority === "high" ? (
                        <span className="text-xs text-white/40 font-mono uppercase tracking-widest">key</span>
                      ) : (
                        <span className="text-white/20 text-[10px] font-mono">&mdash;</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-white/25 text-right font-mono">
        {rankings.length} analyzed &middot; {criticalSpecies.length} critical
      </div>
    </div>
  );
}
