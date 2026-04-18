"use client";

import { motion } from "framer-motion";

const steps = [
  { name: "iNaturalist", desc: "Raw Observations", icon: "🌿", color: "from-green-500 to-emerald-500" },
  { name: "Databricks", desc: "Data Processing", icon: "⚡", color: "from-red-500 to-orange-500" },
  { name: "AWS S3", desc: "Data Lake", icon: "☁️", color: "from-orange-500 to-amber-500" },
  { name: "Snowflake", desc: "Analytics", icon: "❄️", color: "from-blue-400 to-cyan-400" },
  { name: "AWS Lambda", desc: "API Layer", icon: "⚙️", color: "from-amber-500 to-yellow-500" },
  { name: "Gemini AI", desc: "Intelligence", icon: "✨", color: "from-violet-500 to-purple-500" },
  { name: "Next.js", desc: "Dashboard", icon: "🖥️", color: "from-cyan-500 to-teal-500" },
];

export default function PipelineVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <h3 className="text-lg font-semibold mb-2">Data Pipeline</h3>
      <p className="text-sm text-white/40 mb-6">End-to-end flow from raw observations to AI-powered insights</p>

      <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
        {steps.map((step, i) => (
          <div key={step.name} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className="flex flex-col items-center min-w-[90px]"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-xl mb-2 shadow-lg`}>
                {step.icon}
              </div>
              <div className="text-xs font-semibold text-white text-center">{step.name}</div>
              <div className="text-[10px] text-white/40 text-center">{step.desc}</div>
            </motion.div>

            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 + 0.15 }}
                className="mx-1 flex-shrink-0"
              >
                <svg width="24" height="12" viewBox="0 0 24 12" className="text-white/20">
                  <path d="M0 6h20M16 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
