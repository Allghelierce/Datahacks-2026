"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { ZONE_DATA, GLOBAL_STATS, type Zone } from "@/lib/speciesData";
import Navbar from "@/components/ui/Navbar";
import Hero from "@/components/ui/Hero";
import SectionHeader from "@/components/ui/SectionHeader";
import GlobalStats from "@/components/ui/GlobalStats";
import HealthReportCard from "@/components/ui/HealthReportCard";
import CollapseTimeline from "@/components/ui/CollapseTimeline";
import PipelineVisual from "@/components/ui/PipelineVisual";
import ConservationReport from "@/components/ui/ConservationReport";
import ScrollToTop from "@/components/ui/ScrollToTop";
import Footer from "@/components/ui/Footer";

const ThreatMap = dynamic(() => import("@/components/map/ThreatMap"), { ssr: false });
const CascadeGraph = dynamic(() => import("@/components/charts/CascadeGraph"), { ssr: false });

export default function Home() {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  return (
    <main className="min-h-screen bg-gray-950">
      <Navbar />
      <Hero
        totalSpecies={GLOBAL_STATS.totalSpecies}
        totalObservations={GLOBAL_STATS.totalObservations}
        totalRegions={GLOBAL_STATS.totalZones}
      />

      <div className="max-w-7xl mx-auto px-6 space-y-16 pb-8">
        <section>
          <SectionHeader
            title="Threat Overview"
            subtitle="Real-time ecosystem health metrics for San Diego County's threatened species"
          />
          <GlobalStats />
        </section>

        <section>
          <SectionHeader
            id="map"
            title="Ecosystem Health Map"
            subtitle="Click any zone to get a full ecosystem diagnostic — color = health grade, opacity = risk level"
          />
          <ThreatMap
            onZoneClick={(zone) => setSelectedZone(zone)}
            selectedZoneId={selectedZone?.id}
          />
          <div className="flex items-center gap-6 mt-4 justify-center">
            {[
              { color: "bg-emerald-400", label: "A — Healthy" },
              { color: "bg-emerald-300", label: "B — Good" },
              { color: "bg-amber-400", label: "C — Stressed" },
              { color: "bg-orange-400", label: "D — At Risk" },
              { color: "bg-red-400", label: "F — Collapsing" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                <span className="text-[11px] text-white/30">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <AnimatePresence>
          {selectedZone && (
            <section>
              <HealthReportCard
                zone={selectedZone}
                onClose={() => setSelectedZone(null)}
              />
            </section>
          )}
        </AnimatePresence>

        <section>
          <SectionHeader
            id="cascade"
            title="Dependency Cascade Simulator"
            subtitle="Explore how removing one species triggers a chain reaction through the food web"
          />
          <CascadeGraph zone={selectedZone} />
        </section>

        <section>
          <SectionHeader
            id="report"
            title="Conservation Priority Report"
            subtitle="Keystone species ranked by cascade impact — high-keystone + declining = critical priority"
          />
          <ConservationReport />
        </section>

        <section>
          <SectionHeader
            id="warnings"
            title="Collapse Early Warnings"
            subtitle="Zones where ecosystem breakdown indicators are already present"
          />
          <CollapseTimeline />
        </section>

        <section>
          <SectionHeader
            title="How It Works"
            subtitle="From citizen science data to ecosystem collapse prediction"
          />
          <PipelineVisual />
        </section>
      </div>

      <Footer />
      <ScrollToTop />
    </main>
  );
}
