"use client";

import { motion } from "framer-motion";
import { ArrowDownIcon } from "@heroicons/react/24/outline";

interface Props {
  totalSpecies: number;
  totalObservations: number;
  totalRegions: number;
}

export default function Hero({ totalSpecies, totalObservations, totalRegions }: Props) {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-gray-950 to-gray-950" />

      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-white/60">Powered by iNaturalist & Google Gemini</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Understand{" "}
            <span className="gradient-text">Biodiversity</span>
            <br />
            Like Never Before
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12">
            Transforming millions of citizen science observations into actionable
            biodiversity intelligence with cloud-native data pipelines and AI.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid grid-cols-3 gap-4 md:gap-8 max-w-lg mx-auto mb-16"
        >
          <StatBubble value={totalSpecies} label="Species" />
          <StatBubble value={totalObservations} label="Observations" />
          <StatBubble value={totalRegions} label="Regions" />
        </motion.div>

        <motion.a
          href="#map"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 transition"
        >
          <span className="text-sm">Explore the data</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowDownIcon className="w-4 h-4" />
          </motion.div>
        </motion.a>
      </div>
    </section>
  );
}

function StatBubble({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold gradient-text">
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
      <div className="text-xs text-white/40 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
