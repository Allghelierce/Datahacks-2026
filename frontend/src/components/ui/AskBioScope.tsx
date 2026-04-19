"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AskBioScope() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const handleAsk = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch(`/api/snowflake?action=ask&question=${encodeURIComponent(query)}`);
      const data = await res.json();
      const a = data.answer || data.error || "No response";
      setAnswer(a);
      setHistory((prev) => [{ q: query, a }, ...prev].slice(0, 5));
    } catch {
      setAnswer("Failed to connect to Snowflake.");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="relative mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
          placeholder="Ask anything about San Diego biodiversity..."
          className="w-full bg-white/[0.02] border border-white/[0.05] px-4 py-3 text-sm text-white/70 placeholder-white/15 focus:outline-none focus:border-emerald-500/15 transition font-light"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] text-emerald-400/50 hover:text-emerald-400/80 font-mono uppercase tracking-wider transition disabled:opacity-20"
        >
          {loading ? (
            <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400/60 rounded-full animate-spin" />
          ) : "Ask"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border border-white/[0.04] p-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-white/20 font-mono">querying snowflake cortex...</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-2 bg-white/[0.03] animate-pulse" style={{ width: `${60 + i * 15}%`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {!loading && answer && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-emerald-500/[0.06] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-1 bg-emerald-400/60" />
              <span className="text-[9px] text-emerald-400/30 font-mono uppercase tracking-widest">snowflake cortex</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 1 && (
        <div className="mt-3 space-y-1">
          {history.slice(1).map((h, i) => (
            <button
              key={i}
              onClick={() => { setQuery(h.q); setAnswer(h.a); }}
              className="block w-full text-left px-3 py-1.5 text-[10px] text-white/15 hover:text-white/30 hover:bg-white/[0.01] transition truncate"
            >
              {h.q}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 text-[8px] text-white/8 font-mono">
        powered by snowflake cortex ai &middot; queries 77k observations in real time
      </div>
    </div>
  );
}
