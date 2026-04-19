"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAppData } from "@/context/DataContext";
import SectionHeader from "@/components/ui/SectionHeader";
import CollapseTimeline from "@/components/ui/CollapseTimeline";
import ConservationReport from "@/components/ui/ConservationReport";
import Navbar from "@/components/ui/Navbar";
import AskBioScope from "@/components/ui/AskBioScope";

const CascadeGraph = dynamic(() => import("@/components/charts/CascadeGraph"), { ssr: false });
const ThreatMap = dynamic(() => import("@/components/map/ThreatMap"), { ssr: false });

const SHORT_LABELS: Record<string, string> = {
  "Pacific Coast & Tidepools": "Coast",
  "Coastal Sage & Mesa": "Sage Scrub",
  "Chaparral & Canyons": "Chaparral",
  "Cuyamaca & Laguna Mountains": "Mountains",
  "Anza-Borrego Desert": "Desert",
  "San Diego River & Inland Valleys": "River Valleys",
  "South Bay & Border Lands": "South Bay",
  "Urban Parks & Preserves": "Urban",
};

export default function Home() {
  const { data, loading, error: dataError } = useAppData();
  const index = data?.ecosystem_index ?? {};

  const [selectedEcosystem, setSelectedEcosystem] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || !data) return;
    
    // Quick validation for junk/short input
    if (q.length < 3) {
      setError("Please enter a more specific location in San Diego.");
      return;
    }

    setSearching(true);
    setError(null);

    const lowerQ = q.toLowerCase();

    // 1. Direct Keyword Match (Fast)
    for (const [name, eco] of Object.entries(index)) {
      if (name.toLowerCase().includes(lowerQ) || eco.keywords.some((k: string) => k.toLowerCase().includes(lowerQ))) {
        setSelectedEcosystem(name);
        sessionStorage.setItem("ecosystemSelected", "true");
        // Emit event to hide navbar
        window.dispatchEvent(new CustomEvent("ecosystemSelected", { detail: { selected: true } }));
        setSearching(false);
        return;
      }
    }

    // 2. AI Categorization Match (Smart)
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      const ecoList = Object.keys(index).join(", ");
      const prompt = `You are a San Diego County geography and ecology expert. 
        The user typed: "${q}". 
        Is this a real location, landmark, or neighborhood in San Diego County?
        If YES, which of these ecosystem types best describes it: ${ecoList}?
        If NO or if it is not in San Diego County, reply ONLY with the word "UNKNOWN".
        Reply with ONLY the exact ecosystem name or "UNKNOWN".`;

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }], 
            generationConfig: { maxOutputTokens: 20, temperature: 0.1 } 
          }),
        });
        const d = await res.json();
        const answer = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        if (answer && answer !== "UNKNOWN" && index[answer]) {
          setSelectedEcosystem(answer);
          sessionStorage.setItem("ecosystemSelected", "true");
          // Emit event to hide navbar
          window.dispatchEvent(new CustomEvent("ecosystemSelected", { detail: { selected: true } }));
          setSearching(false);
          return;
        }
      } catch (e) {
        console.error("AI Search Error:", e);
      }
    }

    setError("No available data for this area. Try a specific San Diego neighborhood or park.");
    setSearching(false);
  }, [data, index]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#030303] flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/30 text-xs font-mono tracking-widest uppercase animate-pulse">Initializing bioscope Data Cloud...</p>
      </main>
    );
  }

  if (!selectedEcosystem) {
    return (
      <main className="min-h-screen bg-[#030303]">
        <div className="flex flex-col items-center justify-center min-h-[90vh] px-6">
          <div className="w-full max-w-xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {/* Title */}
             <div className="mb-10 flex items-center gap-3">
               <img src="/logo.png" alt="logo" className="w-10 h-10 object-contain" />
               <div>
                 <h1 className="text-3xl font-bold tracking-tight text-white/80 fancy-brand">
                   bioscope
                 </h1>
                 <p className="text-sm uppercase tracking-[0.25em] text-white/15">San Diego County</p>
               </div>
             </div>

            {/* Main prompt */}
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white/80 mb-4 leading-tight">
              Enter a location.
            </h2>
            <p className="text-base text-white/40 mb-8">
              Neighborhood, park, or trail — we map the species, food web, and risks.
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => { setSearchValue(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(searchValue); }}
                placeholder="Mission Trails, Torrey Pines, Cuyamaca..."
                className="w-full bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 text-lg text-white/80 placeholder-white/15 focus:outline-none focus:border-emerald-500/20 transition font-light"
                autoFocus
              />
              <button
                onClick={() => handleSearch(searchValue)}
                disabled={searching || !searchValue.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 text-xs text-emerald-400/60 hover:text-emerald-400/90 font-medium transition disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <div className="w-3.5 h-3.5 border border-emerald-400/30 border-t-emerald-400/60 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p className="text-red-400/40 text-sm mb-4">{error}</p>
            )}

            {/* Popular Locations */}
            <div className="mt-10">
              <p className="text-sm uppercase tracking-[0.2em] text-white/12 mb-6">Browse Popular Locations</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "Coastal", name: "Torrey Pines", type: "Coastal Sage Scrub", risk: "Moderate", color: "text-amber-400" },
                  { id: "Urban Forest", name: "Balboa Park", type: "Riparian / Urban", risk: "Low", color: "text-emerald-400" },
                  { id: "Chaparral", name: "Mission Trails", type: "Chaparral Swath", risk: "Critical", color: "text-red-400" },
                  { id: "Mountain", name: "Cuyamaca Peak", type: "Montane Forest", risk: "Elevated", color: "text-orange-400" },
                  { id: "Ocean", name: "La Jolla Cove", type: "Marine Reserve", risk: "Moderate", color: "text-amber-400" },
                  { id: "Desert", name: "Anza-Borrego", type: "Colorado Desert", risk: "Elevated", color: "text-orange-400" },
                ].map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => {
                      // Find matching ecosystem ID or start search
                      const ecoName = Object.keys(index).find(k => k.toLowerCase().includes(loc.id.toLowerCase())) || Object.keys(index)[0];
                      setSelectedEcosystem(ecoName);
                      sessionStorage.setItem("ecosystemSelected", "true");
                      window.dispatchEvent(new CustomEvent("ecosystemSelected", { detail: { selected: true } }));
                    }}
                    className="flex items-center justify-between p-5 border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-emerald-500/10 transition-all group rounded-lg"
                  >
                    <div className="text-left">
                      <span className="block text-base text-white/70 group-hover:text-white transition font-medium">{loc.name}</span>
                      <span className="block text-sm text-white/15 uppercase tracking-wide mt-1 transition group-hover:text-white/30">{loc.type}</span>
                    </div>
                    <div className="text-right">
                      <span className={`block text-sm font-bold uppercase tracking-widest transition ${loc.color}`}>{loc.risk} Risk</span>
                      <span className="block text-xs text-white/5 mt-0.5 font-mono">RISK LEVEL</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer stats */}
            {data && (
              <div className="mt-10 flex items-center gap-4 text-xs text-white/45 font-mono tracking-wide">
                <span>{data.global_stats.totalSpecies} species</span>
                <span className="text-white/5">|</span>
                <span>{data.global_stats.totalObservations.toLocaleString()} observations</span>
                <span className="text-white/5">|</span>
                <span>{data.global_stats.totalZones} zones</span>
              </div>
            )}
          </motion.div>
          </div>
        </div>
      </main>
    );
  }

  const currentEco = selectedEcosystem ? index[selectedEcosystem] : null;

  return (
    <main className="min-h-screen bg-[#030303]">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/[0.04]" style={{ background: "rgba(3,3,3,0.9)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedEcosystem(null); sessionStorage.setItem("ecosystemSelected", "false"); window.dispatchEvent(new CustomEvent("ecosystemSelected", { detail: { selected: false } })); }} className="text-white/20 hover:text-white/50 transition mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-5 h-5 object-contain opacity-60" />
              <div>
                <h1 className="text-sm font-medium text-white/60">{selectedEcosystem}</h1>
                <p className="text-xs text-white/15 font-mono">{currentEco?.species_count} species &middot; {currentEco?.zone_count} zones</p>
              </div>
            </div>
          </div>
          {currentEco?.keystones?.[0] && (
            <span className="hidden md:block text-xs text-emerald-400/25 font-mono">
              keystone: {currentEco.keystones[0].common_name}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-14">
        <section>
          <SectionHeader
            id="ask"
            title="Ask BioScope"
            subtitle="Query 77K observations with Snowflake Cortex AI"
          />
          <AskBioScope />
        </section>

        <section>
          <SectionHeader
            id="cascade"
            title="Food Web"
            subtitle={`Species dependencies in ${SHORT_LABELS[selectedEcosystem] || selectedEcosystem}`}
          />
          <CascadeGraph ecosystem={selectedEcosystem} />
        </section>

        <section>
          <SectionHeader
            id="report"
            title="Conservation Priority"
            subtitle="Ranked by cascade impact"
          />
          <ConservationReport ecosystem={selectedEcosystem} />
        </section>

        <section>
          <SectionHeader
            id="warnings"
            title="Collapse Warnings"
            subtitle="Zones with breakdown indicators"
          />
          <CollapseTimeline ecosystem={selectedEcosystem} />
        </section>
      </div>
    </main>
  );
}
