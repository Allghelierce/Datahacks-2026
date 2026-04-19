"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import type { Zone } from "@/lib/speciesData";
import { explainRegion } from "@/lib/api";

interface Props {
  zone: Zone;
  onClose: () => void;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "#34d399";
    case "B": return "#6ee7b7";
    case "C": return "#fbbf24";
    case "D": return "#fb923c";
    case "F": return "#ef4444";
    default: return "#64748b";
  }
}

const TROPHIC_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  producer: { label: "Producers", icon: "🌿", desc: "Plants — base of the food web" },
  pollinator: { label: "Pollinators", icon: "🦋", desc: "Bees, butterflies, moths" },
  primary_consumer: { label: "Primary Consumers", icon: "🐛", desc: "Herbivores, mollusks" },
  secondary_consumer: { label: "Secondary Consumers", icon: "🦎", desc: "Reptiles, amphibians, fish" },
  tertiary_consumer: { label: "Tertiary Consumers", icon: "🐦", desc: "Birds, small mammals" },
  apex_predator: { label: "Apex Predators", icon: "🦅", desc: "Raptors, large predators" },
  decomposer: { label: "Decomposers", icon: "🍄", desc: "Fungi — nutrient recyclers" },
};

const TROPHIC_ORDER = ["producer", "pollinator", "primary_consumer", "secondary_consumer", "tertiary_consumer", "apex_predator", "decomposer"];

export default function HealthReportCard({ zone, onClose }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const trophicSummary = TROPHIC_ORDER
        .map((l) => `${TROPHIC_LABELS[l]?.label}: ${(zone.trophic as any)[l]?.count ?? 0} species`)
        .join(", ");

      const resp = await explainRegion(zone.name, {
        grade: zone.health.grade,
        score: zone.health.score,
        total_species: zone.total_species,
        trophic_completeness: zone.health.trophic_completeness,
        trophic_summary: trophicSummary,
        risks: zone.health.risks.map((r: any) => r.message).join("; "),
        trend: zone.health.trend_pct,
      });
      setExplanation(resp.explanation);
    } catch {
      setExplanation("Connect the API to get AI-powered analysis. In the meantime, review the trophic breakdown below for insights.");
    } finally {
      setLoading(false);
    }
  };

  const maxTrophicCount = Math.max(
    ...TROPHIC_ORDER.map((l) => (zone.trophic as any)[l]?.count ?? 0),
    1
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="relative">
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: gradeColor(zone.health.grade) }}
        />

        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl md:text-3xl font-bold"
              >
                {zone.name}
              </motion.h2>
              <p className="text-white/40 text-sm mt-1">Ecosystem Health Assessment — San Diego County</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition">
              <XMarkIcon className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Grade + Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="col-span-2 md:col-span-1 rounded-xl p-5 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${gradeColor(zone.health.grade)}15, ${gradeColor(zone.health.grade)}05)`,
                border: `1px solid ${gradeColor(zone.health.grade)}30`,
              }}
            >
              <div
                className="text-6xl font-black leading-none"
                style={{ color: gradeColor(zone.health.grade) }}
              >
                {zone.health.grade}
              </div>
              <div className="text-xs text-white/40 uppercase tracking-wider mt-2">Health Grade</div>
              <div className="text-sm font-semibold text-white/60 mt-1">{zone.health.score}/100</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4 text-center"
            >
              <div className="text-2xl font-bold text-cyan-400">{zone.total_species}</div>
              <div className="text-[10px] text-cyan-400/60 uppercase tracking-wider mt-1">Threatened Species</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 text-center"
            >
              <div className="text-2xl font-bold text-violet-400">{zone.total_observations.toLocaleString()}</div>
              <div className="text-[10px] text-violet-400/60 uppercase tracking-wider mt-1">Observations</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center"
            >
              <div className="text-2xl font-bold text-amber-400">{zone.health.trophic_completeness}%</div>
              <div className="text-[10px] text-amber-400/60 uppercase tracking-wider mt-1">Trophic Complete</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`rounded-xl p-4 text-center ${
                zone.health.trend_pct >= 0
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <div className={`text-2xl font-bold ${zone.health.trend_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                {zone.health.trend_pct >= 0 ? "+" : ""}{zone.health.trend_pct}%
              </div>
              <div className={`text-[10px] uppercase tracking-wider mt-1 ${
                zone.health.trend_pct >= 0 ? "text-green-400/60" : "text-red-400/60"
              }`}>
                Species Trend
              </div>
            </motion.div>
          </div>

          {/* Risks */}
          {zone.health.risks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="space-y-2 mb-6"
            >
              {zone.health.risks.map((risk: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl ${
                    risk.type === "critical"
                      ? "bg-red-500/10 border border-red-500/15"
                      : "bg-amber-500/10 border border-amber-500/15"
                  }`}
                >
                  {risk.type === "critical" ? (
                    <ShieldExclamationIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${risk.type === "critical" ? "text-red-300" : "text-amber-300"}`}>
                    {risk.message}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Trophic Breakdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Food Web Analysis</h3>
            <div className="space-y-2">
              {TROPHIC_ORDER.map((level, i) => {
                const info = TROPHIC_LABELS[level];
                const data = (zone.trophic as any)[level] || { count: 0, species: [] };
                const isExpanded = expandedLevel === level;
                const barWidth = (data.count / maxTrophicCount) * 100;
                const isMissing = data.count === 0;

                return (
                  <motion.div
                    key={level}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    <button
                      onClick={() => setExpandedLevel(isExpanded ? null : level)}
                      className={`w-full text-left rounded-xl p-3 transition-all ${
                        isMissing
                          ? "bg-red-500/5 border border-red-500/10"
                          : isExpanded
                          ? "bg-white/5 border border-white/10"
                          : "hover:bg-white/[0.03] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{info?.icon}</span>
                          <div>
                            <span className="text-sm font-medium">{info?.label}</span>
                            <span className="text-xs text-white/30 ml-2">{info?.desc}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isMissing ? "text-red-400" : "text-white"}`}>
                            {data.count}
                          </span>
                          {data.species.length > 0 && (
                            <ChevronDownIcon className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.8, delay: 0.5 + i * 0.05 }}
                          className={`h-full rounded-full ${isMissing ? "bg-red-500/30" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`}
                        />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && data.species.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 py-2 flex flex-wrap gap-1.5">
                            {data.species.map((sp: string) => (
                              <span
                                key={sp}
                                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] text-white/60"
                              >
                                {sp}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Gemini Explain */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <button
              onClick={handleExplain}
              disabled={loading}
              className="group w-full relative overflow-hidden rounded-xl py-4 px-6 font-medium transition-all duration-300
                bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500
                disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                <SparklesIcon className={`w-5 h-5 ${loading ? "animate-spin" : "group-hover:rotate-12 transition-transform"}`} />
                <span>{loading ? "Analyzing ecosystem with Gemini AI..." : "Get AI Collapse Analysis"}</span>
              </div>
              {!loading && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}
            </button>

            <AnimatePresence>
              {explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <SparklesIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        AI Ecosystem Analysis — Google Gemini
                      </span>
                    </div>
                    <p className="text-white/80 leading-relaxed whitespace-pre-line">{explanation}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
