"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import type { RegionDetail as RegionDetailType } from "@/types";
import { explainRegion } from "@/lib/api";
import TrendChart from "@/components/charts/TrendChart";

interface Props {
  detail: RegionDetailType;
  onClose: () => void;
}

export default function RegionDetailPanel({ detail, onClose }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const resp = await explainRegion(detail.region.region, {
        biodiversity_score: detail.region.biodiversity_score,
        unique_species: detail.region.unique_species,
        total_observations: detail.region.total_observations,
        species_change: detail.decline_info?.species_change,
        pct_change: detail.decline_info?.pct_change,
      });
      setExplanation(resp.explanation);
    } catch {
      setExplanation("Failed to generate explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isGrowing = (detail.decline_info?.pct_change ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="relative p-6 pb-0">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="flex justify-between items-start mb-6">
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-bold"
            >
              {detail.region.region}
            </motion.h2>
            <p className="text-white/40 text-sm mt-1">Regional biodiversity analysis</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition"
          >
            <XMarkIcon className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center"
          >
            <div className="text-3xl font-bold text-emerald-400">{detail.region.biodiversity_score}</div>
            <div className="text-xs text-emerald-400/60 uppercase tracking-wider mt-1">Shannon Index</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4 text-center"
          >
            <div className="text-3xl font-bold text-cyan-400">{detail.region.unique_species}</div>
            <div className="text-xs text-cyan-400/60 uppercase tracking-wider mt-1">Species</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 text-center"
          >
            <div className="text-3xl font-bold text-violet-400">
              {detail.region.total_observations.toLocaleString()}
            </div>
            <div className="text-xs text-violet-400/60 uppercase tracking-wider mt-1">Observations</div>
          </motion.div>

          {detail.decline_info && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`rounded-xl p-4 text-center ${
                isGrowing
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <div className={`text-3xl font-bold flex items-center justify-center gap-1 ${
                isGrowing ? "text-green-400" : "text-red-400"
              }`}>
                {isGrowing ? (
                  <ArrowTrendingUpIcon className="w-6 h-6" />
                ) : (
                  <ArrowTrendingDownIcon className="w-6 h-6" />
                )}
                {Math.abs(detail.decline_info.pct_change)}%
              </div>
              <div className={`text-xs uppercase tracking-wider mt-1 ${
                isGrowing ? "text-green-400/60" : "text-red-400/60"
              }`}>
                5yr Change
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="px-6 pb-6">
        <TrendChart
          data={detail.trends}
          title="Species Diversity Over Time"
          subtitle={`Tracking unique species observed in ${detail.region.region}`}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
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
              <span>{loading ? "Analyzing with Gemini AI..." : "Explain This Region"}</span>
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
                transition={{ duration: 0.4 }}
                className="mt-4"
              >
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      AI Analysis — Powered by Google Gemini
                    </span>
                  </div>
                  <p className="text-white/80 leading-relaxed whitespace-pre-line">{explanation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
