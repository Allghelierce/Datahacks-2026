"use client";

import { motion } from "framer-motion";
import type { Region } from "@/types";

interface Props {
  regions: Region[];
  onRegionClick: (region: Region) => void;
  selectedRegion?: string;
}

function getScoreColor(score: number): string {
  if (score >= 4) return "text-emerald-400";
  if (score >= 3) return "text-lime-400";
  if (score >= 2) return "text-amber-400";
  if (score >= 1) return "text-orange-400";
  return "text-red-400";
}

function getScoreBar(score: number, max: number): number {
  return Math.min((score / max) * 100, 100);
}

export default function RankingsTable({ regions, onRegionClick, selectedRegion }: Props) {
  const maxScore = Math.max(...regions.map((r) => r.biodiversity_score), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Region</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Score</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider hidden md:table-cell">Species</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider hidden md:table-cell">Observations</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-white/30 uppercase tracking-wider w-48 hidden lg:table-cell">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r, i) => (
              <motion.tr
                key={r.region}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => onRegionClick(r)}
                className={`border-b border-white/5 cursor-pointer transition-all duration-200
                  ${selectedRegion === r.region
                    ? "bg-emerald-500/10"
                    : "hover:bg-white/5"
                  }`}
              >
                <td className="px-6 py-4">
                  <span className={`text-sm font-bold ${i < 3 ? "text-emerald-400" : "text-white/40"}`}>
                    #{r.rank}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-white">{r.region}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-bold ${getScoreColor(r.biodiversity_score)}`}>
                    {r.biodiversity_score}
                  </span>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <span className="text-sm text-white/60">{r.unique_species}</span>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <span className="text-sm text-white/60">{r.total_observations.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${getScoreBar(r.biodiversity_score, maxScore)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
