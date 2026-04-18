"use client";

import { useState } from "react";
import type { RegionDetail as RegionDetailType, ExplainResponse } from "@/types";
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{detail.region.region}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
          &times;
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{detail.region.biodiversity_score}</div>
          <div className="text-sm text-gray-600">Biodiversity Score</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{detail.region.unique_species}</div>
          <div className="text-sm text-gray-600">Unique Species</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{detail.region.total_observations.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Observations</div>
        </div>
      </div>

      {detail.decline_info && (
        <div className={`rounded-lg p-3 mb-6 ${detail.decline_info.pct_change < 0 ? "bg-red-50" : "bg-green-50"}`}>
          <span className={`font-semibold ${detail.decline_info.pct_change < 0 ? "text-red-600" : "text-green-600"}`}>
            {detail.decline_info.pct_change > 0 ? "+" : ""}{detail.decline_info.pct_change}% species change
          </span>
          <span className="text-gray-600 text-sm ml-2">
            ({detail.decline_info.first_year_species} → {detail.decline_info.last_year_species} species)
          </span>
        </div>
      )}

      <TrendChart data={detail.trends} title={`Species Trends — ${detail.region.region}`} />

      <div className="mt-6">
        <button
          onClick={handleExplain}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
        >
          {loading ? "Generating explanation..." : "Explain This Region (Gemini AI)"}
        </button>

        {explanation && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
            <h4 className="font-semibold mb-2 text-sm text-blue-600">AI Analysis (Powered by Gemini)</h4>
            <p className="text-gray-700 whitespace-pre-line">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
