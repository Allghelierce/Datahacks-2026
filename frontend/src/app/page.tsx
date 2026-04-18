"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import type { Region, RegionDetail as RegionDetailType, MonthlyTrend, DecliningRegion } from "@/types";
import { getRegions, getRegionDetail, getTrends } from "@/lib/api";
import Navbar from "@/components/ui/Navbar";
import Hero from "@/components/ui/Hero";
import SectionHeader from "@/components/ui/SectionHeader";
import StatsGrid from "@/components/ui/StatsGrid";
import TrendChart from "@/components/charts/TrendChart";
import RankingsTable from "@/components/ui/RankingsTable";
import RegionDetailPanel from "@/components/ui/RegionDetail";
import PipelineVisual from "@/components/ui/PipelineVisual";
import Footer from "@/components/ui/Footer";

const BiodiversityMap = dynamic(() => import("@/components/map/BiodiversityMap"), { ssr: false });

const MOCK_REGIONS: Region[] = [
  { region: "California", biodiversity_score: 4.23, unique_species: 342, total_observations: 5210, rank: 1 },
  { region: "Florida", biodiversity_score: 3.98, unique_species: 298, total_observations: 4100, rank: 2 },
  { region: "Texas", biodiversity_score: 3.76, unique_species: 271, total_observations: 3800, rank: 3 },
  { region: "Oregon", biodiversity_score: 3.54, unique_species: 234, total_observations: 2900, rank: 4 },
  { region: "Colorado", biodiversity_score: 3.31, unique_species: 198, total_observations: 2500, rank: 5 },
  { region: "Washington", biodiversity_score: 3.12, unique_species: 187, total_observations: 2300, rank: 6 },
  { region: "Arizona", biodiversity_score: 2.89, unique_species: 165, total_observations: 1900, rank: 7 },
  { region: "New Mexico", biodiversity_score: 2.67, unique_species: 142, total_observations: 1600, rank: 8 },
  { region: "Utah", biodiversity_score: 2.45, unique_species: 128, total_observations: 1400, rank: 9 },
  { region: "Nevada", biodiversity_score: 2.11, unique_species: 98, total_observations: 1100, rank: 10 },
];

const MOCK_TRENDS: MonthlyTrend[] = Array.from({ length: 36 }, (_, i) => {
  const date = new Date(2022, i, 1);
  const base = 400 + Math.sin(i / 6) * 80;
  return {
    year_month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    total_unique_species: Math.round(base + Math.random() * 40 + i * 2),
    total_observations: Math.round((base + Math.random() * 40) * 6),
    regions_reporting: 10,
  };
});

const MOCK_DECLINING: DecliningRegion[] = [
  { region: "Nevada", first_year_species: 120, last_year_species: 98, species_change: -22, pct_change: -18.3 },
  { region: "Utah", first_year_species: 145, last_year_species: 128, species_change: -17, pct_change: -11.7 },
  { region: "Arizona", first_year_species: 178, last_year_species: 165, species_change: -13, pct_change: -7.3 },
];

const MOCK_REGION_DETAIL: Record<string, RegionDetailType> = Object.fromEntries(
  MOCK_REGIONS.map((r) => [
    r.region,
    {
      region: r,
      trends: Array.from({ length: 36 }, (_, i) => {
        const date = new Date(2022, i, 1);
        const base = r.unique_species / 3 + Math.sin(i / 4) * 15;
        return {
          year_month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          unique_species: Math.round(base + Math.random() * 10 + i * 0.5),
          observation_count: Math.round((base + Math.random() * 10) * 4),
          region: r.region,
        };
      }),
      decline_info: MOCK_DECLINING.find((d) => d.region === r.region) ?? {
        region: r.region,
        first_year_species: Math.round(r.unique_species * 0.85),
        last_year_species: r.unique_species,
        species_change: Math.round(r.unique_species * 0.15),
        pct_change: 15,
      },
    },
  ])
);

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<RegionDetailType | null>(null);
  const [globalTrends, setGlobalTrends] = useState<MonthlyTrend[]>([]);
  const [decliningRegions, setDecliningRegions] = useState<DecliningRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [regionsData, trendsData] = await Promise.all([getRegions(), getTrends()]);
        setRegions(regionsData);
        setGlobalTrends(trendsData.monthly_trends);
        setDecliningRegions(trendsData.declining_regions);
      } catch {
        setRegions(MOCK_REGIONS);
        setGlobalTrends(MOCK_TRENDS);
        setDecliningRegions(MOCK_DECLINING);
        setUsingMock(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRegionClick = async (region: Region) => {
    if (usingMock) {
      setSelectedDetail(MOCK_REGION_DETAIL[region.region] ?? null);
      return;
    }
    const regionId = region.region.toLowerCase().replace(/\s+/g, "-");
    try {
      const detail = await getRegionDetail(regionId);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(MOCK_REGION_DETAIL[region.region] ?? null);
    }
  };

  const totalSpecies = regions.reduce((s, r) => s + r.unique_species, 0);
  const totalObs = regions.reduce((s, r) => s + r.total_observations, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 float-animation">
            <span className="text-2xl">🌿</span>
          </div>
          <div className="text-white/40 text-sm">Loading BioScope...</div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <Navbar />
      <Hero totalSpecies={totalSpecies} totalObservations={totalObs} totalRegions={regions.length} />

      <div className="max-w-7xl mx-auto px-6 space-y-12 pb-8">
        {usingMock && (
          <div className="glass rounded-xl px-4 py-3 border-amber-500/20 bg-amber-500/5 text-center">
            <span className="text-amber-400 text-sm">
              Demo mode — showing sample data. Connect the API for live biodiversity data.
            </span>
          </div>
        )}

        <section>
          <SectionHeader
            title="Key Insights"
            subtitle="Overview of biodiversity metrics across monitored regions"
          />
          <StatsGrid regions={regions} decliningRegions={decliningRegions} />
        </section>

        <section>
          <SectionHeader
            id="map"
            title="Biodiversity Map"
            subtitle="Click a region to explore its biodiversity profile"
          />
          <BiodiversityMap
            regions={regions}
            onRegionClick={handleRegionClick}
            selectedRegion={selectedDetail?.region.region}
          />
          <div className="flex items-center gap-6 mt-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/40">High (4+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-lime-400" />
              <span className="text-xs text-white/40">Good (3-4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-xs text-white/40">Moderate (2-3)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-xs text-white/40">Low (&lt;2)</span>
            </div>
          </div>
        </section>

        <AnimatePresence>
          {selectedDetail && (
            <section>
              <RegionDetailPanel detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
            </section>
          )}
        </AnimatePresence>

        <section>
          <SectionHeader
            id="trends"
            title="Global Trends"
            subtitle="Tracking species diversity across all monitored regions over time"
          />
          <TrendChart
            data={globalTrends}
            title="Species Diversity Over Time"
            subtitle="Unique species observed per month across all regions"
            color="#34d399"
          />
        </section>

        <section>
          <SectionHeader
            id="rankings"
            title="Region Rankings"
            subtitle="Ranked by Shannon Diversity Index — click any region for details"
          />
          <RankingsTable
            regions={regions}
            onRegionClick={handleRegionClick}
            selectedRegion={selectedDetail?.region.region}
          />
        </section>

        <section>
          <SectionHeader
            title="How It Works"
            subtitle="Our cloud-native data pipeline from raw observations to AI insights"
          />
          <PipelineVisual />
        </section>
      </div>

      <Footer />
    </main>
  );
}
