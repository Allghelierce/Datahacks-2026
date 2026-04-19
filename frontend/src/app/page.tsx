"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAppData } from "@/context/DataContext";
import SectionHeader from "@/components/ui/SectionHeader";
import CollapseTimeline from "@/components/ui/CollapseTimeline";
import ConservationReport from "@/components/ui/ConservationReport";

const CascadeGraph = dynamic(() => import("@/components/charts/CascadeGraph"), { ssr: false });

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
        <p className="text-white/30 text-xs font-mono tracking-widest uppercase animate-pulse">Initializing BioScope Data Cloud...</p>
      </main>
    );
  }

  if (!selectedEcosystem) {
    return (
      <main className="min-h-screen bg-[#030303] flex items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {/* Title */}
            <div className="mb-10">
              <h1 className="text-lg font-semibold tracking-tight text-white/80 mb-1">
                Bio<span className="gradient-text">Scope</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/15">San Diego County</p>
            </div>

            {/* Main prompt */}
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/80 mb-2 leading-tight">
              Enter a location.
            </h2>
            <p className="text-sm text-white/20 mb-8">
              Neighborhood, park, or trail — we map the species, food web, and risks.
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => { setSearchValue(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(searchValue); }}
                placeholder="Torrey Pines, Balboa Park, La Jolla..."
                className="w-full bg-white/[0.03] border border-white/[0.06] px-4 py-3.5 text-sm text-white/80 placeholder-white/15 focus:outline-none focus:border-emerald-500/20 transition font-light"
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
              <p className="text-red-400/40 text-xs mb-4">{error}</p>
            )}

            {/* Ecosystem grid */}
            <div className="mt-8">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/12 mb-3">Or choose</p>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(index).map(([name, eco]) => (
                  <button
                    key={name}
                    onClick={() => setSelectedEcosystem(name)}
                    className="text-left px-3 py-2.5 border border-white/[0.04] hover:border-emerald-500/10 hover:bg-white/[0.02] transition-all group"
                  >
                    <span className="block text-[11px] text-white/40 group-hover:text-white/60 transition font-medium">
                      {SHORT_LABELS[name] || name}
                    </span>
                    <span className="block text-[9px] text-white/10 mt-0.5 font-mono">{eco.species_count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer stats */}
            {data && (
              <div className="mt-10 flex items-center gap-4 text-[9px] text-white/10 font-mono tracking-wide">
                <span>{data.global_stats.totalSpecies} species</span>
                <span className="text-white/5">|</span>
                <span>{data.global_stats.totalObservations.toLocaleString()} observations</span>
                <span className="text-white/5">|</span>
                <span>{data.global_stats.totalZones} zones</span>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    );
  }

  const currentEco = selectedEcosystem ? index[selectedEcosystem] : null;

  return (
    <main className="min-h-screen bg-[#030303]">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/[0.04]" style={{ background: "rgba(3,3,3,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedEcosystem(null)} className="text-white/20 hover:text-white/50 transition mr-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xs font-medium text-white/60">{selectedEcosystem}</h1>
              <p className="text-[9px] text-white/15 font-mono">{currentEco?.species_count} species &middot; {currentEco?.zone_count} zones</p>
            </div>
          </div>
          {currentEco?.keystones?.[0] && (
            <span className="hidden md:block text-[9px] text-emerald-400/25 font-mono">
              keystone: {currentEco.keystones[0].common_name}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-14">
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
          <ConservationReport />
        </section>

        <section>
          <SectionHeader
            id="warnings"
            title="Collapse Warnings"
            subtitle="Zones with breakdown indicators"
          />
          <CollapseTimeline />
        </section>
      </div>
    </main>
  );
}
