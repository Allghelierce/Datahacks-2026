"use client";

import { motion } from "framer-motion";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { COLLAPSE_PREDICTIONS } from "@/lib/speciesData";

function gradeColor(grade: string): string {
  switch (grade) {
    case "D": return "#fb923c";
    case "F": return "#ef4444";
    default: return "#fbbf24";
  }
}

export default function CollapseTimeline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Collapse Early Warnings</h3>
          <p className="text-sm text-white/40">
            {COLLAPSE_PREDICTIONS.length} zones showing signs of ecosystem breakdown
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {COLLAPSE_PREDICTIONS.map((pred, i) => (
          <motion.div
            key={pred.zone_id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 hover:bg-red-500/10 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span
                  className="text-2xl font-black w-10 text-center"
                  style={{ color: gradeColor(pred.grade) }}
                >
                  {pred.grade}
                </span>
                <div>
                  <div className="font-semibold text-sm">{pred.zone}</div>
                  <div className="text-xs text-white/30">Score: {pred.score}/100</div>
                </div>
              </div>
              {pred.missing_levels.length > 0 && (
                <div className="flex items-center gap-1">
                  {pred.missing_levels.map((level) => (
                    <span
                      key={level}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/20"
                    >
                      No {level}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {pred.risks.length > 0 && (
              <div className="space-y-1 mb-3">
                {pred.risks.slice(0, 2).map((risk: any, j: number) => (
                  <div key={j} className="text-xs text-red-300/70 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {risk.message}
                  </div>
                ))}
              </div>
            )}

            {pred.at_risk_species.length > 0 && (
              <div>
                <div className="text-[10px] text-white/20 uppercase tracking-wider mb-1.5">
                  Species at cascade risk
                </div>
                <div className="flex flex-wrap gap-1">
                  {pred.at_risk_species.map((sp) => (
                    <span
                      key={sp}
                      className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-white/50 border border-white/5 italic"
                    >
                      {sp}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
