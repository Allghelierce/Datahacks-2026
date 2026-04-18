"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Region, RegionDetail as RegionDetailType } from "@/types";
import { getRegions, getRegionDetail, getTrends } from "@/lib/api";
import TrendChart from "@/components/charts/TrendChart";
import RegionDetailPanel from "@/components/ui/RegionDetail";

const BiodiversityMap = dynamic(() => import("@/components/map/BiodiversityMap"), { ssr: false });

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<RegionDetailType | null>(null);
  const [globalTrends, setGlobalTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [regionsData, trendsData] = await Promise.all([getRegions(), getTrends()]);
        setRegions(regionsData);
        setGlobalTrends(trendsData.monthly_trends);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRegionClick = async (region: Region) => {
    const regionId = region.region.toLowerCase().replace(/\s+/g, "-");
    try {
      const detail = await getRegionDetail(regionId);
      setSelectedDetail(detail);
    } catch (err) {
      console.error("Failed to load region:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-500">Loading BioScope...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-900">BioScope</h1>
          <p className="text-gray-500">Regional Biodiversity Intelligence Dashboard</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">Biodiversity Map</h2>
          <BiodiversityMap regions={regions} onRegionClick={handleRegionClick} />
          <p className="text-sm text-gray-400 mt-2">Click a region to see details. Circle size = species count. Color = biodiversity score.</p>
        </section>

        {selectedDetail && (
          <section>
            <RegionDetailPanel detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
          </section>
        )}

        <section>
          <TrendChart data={globalTrends} title="Global Biodiversity Trends" />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Region Rankings</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Region</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Species</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {regions.map((r) => (
                  <tr
                    key={r.region}
                    className="hover:bg-blue-50 cursor-pointer transition"
                    onClick={() => handleRegionClick(r)}
                  >
                    <td className="px-4 py-3 text-sm font-medium">#{r.rank}</td>
                    <td className="px-4 py-3 text-sm">{r.region}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{r.biodiversity_score}</td>
                    <td className="px-4 py-3 text-sm">{r.unique_species}</td>
                    <td className="px-4 py-3 text-sm">{r.total_observations.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="bg-white border-t mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400">
          BioScope — Built at DataHacks 2026 | Data: iNaturalist | AI: Google Gemini
        </div>
      </footer>
    </main>
  );
}
