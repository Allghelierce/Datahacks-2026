"use client";

import { motion } from "framer-motion";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { useAppData } from "@/context/DataContext";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { data, loading } = useAppData();
  const GLOBAL_STATS = data?.global_stats;
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Check if an ecosystem is selected via session storage
    const checkEcosystem = () => {
      const isSelected = sessionStorage.getItem("ecosystemSelected") === "true";
      setShowBanner(!isSelected);
    };

    // Check on mount
    checkEcosystem();

    // Listen for storage changes
    const handleStorageChange = () => checkEcosystem();
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event
    window.addEventListener("ecosystemSelected", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("ecosystemSelected", handleStorageChange);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-6 right-6 z-[60] pointer-events-none">
      {!loading && GLOBAL_STATS && (
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl pointer-events-auto shadow-2xl shadow-red-500/10"
        >
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider text-red-400 uppercase">{GLOBAL_STATS.zonesAtRisk} Zones at Risk</span>
        </motion.div>
      )}
    </div>
  );
}
