"use client";

import { motion } from "framer-motion";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { GLOBAL_STATS } from "@/lib/speciesData";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <ShieldExclamationIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Bio<span className="gradient-text">Scope</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Ecosystem Early Warning System</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <a href="#map" className="text-sm text-white/60 hover:text-white transition">Health Map</a>
          <a href="#cascade" className="text-sm text-white/60 hover:text-white transition">Cascade Sim</a>
          <a href="#warnings" className="text-sm text-white/60 hover:text-white transition">Warnings</a>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-red-400">{GLOBAL_STATS.zonesAtRisk} Zones at Risk</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
