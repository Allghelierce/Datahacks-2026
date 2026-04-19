"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAppData } from "@/context/DataContext";
import { ECOSYSTEM_INDEX } from "@/lib/speciesData";

function gradeColor(grade: string): string {
  switch (grade) {
    case "D": return "rgba(255,255,255,0.5)";
    case "F": return "rgba(239,68,68,0.7)";
    default: return "rgba(255,255,255,0.3)";
  }
}

interface Props {
  ecosystem?: string | null;
}

export default function CollapseTimeline({ ecosystem }: Props) {
  const { data, loading } = useAppData();
  const allPredictions = data?.collapse_predictions ?? [];

  const predictions = useMemo(() => {
    if (!ecosystem || !ECOSYSTEM_INDEX[ecosystem]) return allPredictions;
    const zoneIds = new Set(ECOSYSTEM_INDEX[ecosystem].zones.map((z) => z.id));
    return allPredictions.filter((p: any) => zoneIds.has(p.zone_id));
  }, [ecosystem, allPredictions]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-white/[0.02] rounded-lg" />;
  }

  if (predictions.length === 0) {
    return (
      <div className="text-xs text-white/40 font-mono py-6 text-center">
        No collapse warnings for this ecosystem.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 font-mono mb-3">
        {predictions.length} zones flagged
      </div>

      {predictions.map((pred: any, i: number) => (
        <motion.div
          key={pred.zone_id}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.03 }}
          className="border border-white/[0.06] p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <span
                className="text-lg font-bold font-mono w-7 text-center"
                style={{ color: gradeColor(pred.grade) }}
              >
                {pred.grade}
              </span>
              <div>
                <div className="text-xs font-medium text-white/80">{pred.zone}</div>
                <div className="text-[9px] text-white/40 font-mono">{pred.score}/100</div>
              </div>
            </div>
            {pred.missing_levels.length > 0 && (
              <div className="flex items-center gap-1">
                {pred.missing_levels.map((level: string) => (
                  <span
                    key={level}
                    className="px-1.5 py-0.5 text-[8px] text-red-400/60 border border-red-500/15 font-mono uppercase"
                  >
                    no {level}
                  </span>
                ))}
              </div>
            )}
          </div>

          {pred.risks.length > 0 && (
            <div className="space-y-0.5 mb-2 ml-10">
              {pred.risks.slice(0, 2).map((risk: any, j: number) => (
                <div key={j} className="text-[10px] text-white/50">
                  {risk.message}
                </div>
              ))}
            </div>
          )}

          {pred.at_risk_species.length > 0 && (
            <div className="ml-10">
              <div className="flex flex-wrap gap-1">
                {pred.at_risk_species.map((sp: string) => (
                  <span
                    key={sp}
                    className="px-1.5 py-0.5 text-[9px] text-white/50 border border-white/[0.08] italic font-mono"
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
  );
}
