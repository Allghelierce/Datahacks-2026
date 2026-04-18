"use client";

import { motion } from "framer-motion";

const techStack = [
  "Databricks",
  "Snowflake",
  "AWS Lambda",
  "AWS S3",
  "Google Gemini",
  "Next.js",
  "DigitalOcean",
  "iNaturalist",
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs text-white/20 uppercase tracking-[0.3em] mb-4">Powered By</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 rounded-full text-xs text-white/40 border border-white/10 hover:border-white/20 hover:text-white/60 transition"
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[10px]">
              B
            </div>
            <span className="text-sm font-semibold">
              Bio<span className="gradient-text">Scope</span>
            </span>
          </div>
          <p className="text-xs text-white/20">
            Built at DataHacks 2026 — UC San Diego
          </p>
          <p className="text-xs text-white/15 mt-1">
            Data sourced from iNaturalist citizen science observations
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
