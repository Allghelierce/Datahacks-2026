"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { zoom as d3Zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select, selectAll } from "d3-selection";
import { drag as d3Drag } from "d3-drag";
import "d3-transition";
import {
  APP_DATA_URL,
  type DependencyEdge,
  type Zone,
  type EcosystemGraph,
  type ZoneNode,
  type GlobalStats,
  type EcosystemIndex,
  type DependencyNode,
} from "@/lib/speciesData";

interface GraphNode {
  id: string;
  common_name: string;
  trophic_level: string;
  observations: number;
  decline_trend: number;
  keystone_score: number;
  zone_count?: number;
  zone_keystone_score?: number;
  family?: string;
  order?: string;
}

interface SimNode extends SimulationNodeDatum {
  data: GraphNode;
  radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edgeType: string;
}

interface RemovalLogEntry {
  timestamp: string;
  speciesId: string;
  speciesName: string;
  trophicLevel: string;
  observations: number;
  keystoneScore: number;
  cascadeVictimCount: number;
  cascadeVictimNames: string[];
  trophicLevelsAffected: string[];
  impactPct: number;
  totalSpecies: number;
  aiAssessment: string | null;
  ecosystem: string;
}

interface Props {
  zone?: Zone | null;
  ecosystem?: string | null;
}

const LEVEL_COLORS: Record<string, string> = {
  producer: "#6ee7b7",
  pollinator: "#fda4af",
  primary_consumer: "#fcd34d",
  secondary_consumer: "#67e8f9",
  tertiary_consumer: "#a5b4fc",
  apex_predator: "#fca5a5",
  decomposer: "#c4b5fd",
};

const EDGE_COLORS: Record<string, string> = {
  "food source": "rgba(110,231,183,0.18)",
  pollination: "rgba(253,164,175,0.18)",
  prey: "rgba(253,186,116,0.18)",
  "nutrient cycling": "rgba(196,181,253,0.18)",
};

const EDGE_COLORS_BRIGHT: Record<string, string> = {
  "food source": "#6ee7b7",
  pollination: "#fda4af",
  prey: "#fdba74",
  "nutrient cycling": "#c4b5fd",
};

const ECO_ICONS: Record<string, string> = {
  "Pacific Coast & Tidepools": "🌊",
  "Coastal Sage & Mesa": "🌿",
  "Chaparral & Canyons": "⛰️",
  "Cuyamaca & Laguna Mountains": "🌲",
  "Anza-Borrego Desert": "🌵",
  "San Diego River & Inland Valleys": "💧",
  "South Bay & Border Lands": "🦋",
  "Urban Parks & Preserves": "⛲",
};

const TROPHIC_LAYERS: Record<string, number> = {
  apex_predator: 0.06,
  tertiary_consumer: 0.20,
  secondary_consumer: 0.34,
  primary_consumer: 0.48,
  pollinator: 0.62,
  producer: 0.76,
  decomposer: 0.92,
};

export default function CascadeGraph({ zone, ecosystem }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<ReturnType<typeof d3Drag<any, SimNode>> | null>(null);

  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredThrottled = useCallback((id: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (id === null) { hoverTimerRef.current = setTimeout(() => setHoveredNode(null), 30); }
    else setHoveredNode(id);
  }, []);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [snowflakeData, setSnowflakeData] = useState<any>(null);
  const [snowflakeLoading, setSnowflakeLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTrophicFilters, setActiveTrophicFilters] = useState<Set<string>>(new Set(Object.keys(LEVEL_COLORS)));
  const [removedNodes, setRemovedNodes] = useState<Set<string>>(new Set());
  const [cascadeAnimating, setCascadeAnimating] = useState(false);
  const [animatedVictims, setAnimatedVictims] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);
  const [cascadeTree, setCascadeTree] = useState<{ root: string; tree: Map<string, string[]> } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [removalLog, setRemovalLog] = useState<RemovalLogEntry[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedEcosystem, setSelectedEcosystem] = useState<string | null>(ecosystem ?? null);
  const [ecoSearchQuery, setEcoSearchQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [showEcoBrowser, setShowEcoBrowser] = useState(!ecosystem);
  const [zoneGraphs, setZoneGraphs] = useState<Record<string, { nodes: GraphNode[]; edges: DependencyEdge[] }>>({});
  const [ecoGraphs, setEcoGraphs] = useState<Record<string, EcosystemGraph>>({});
  const [appData, setAppData] = useState<{
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    ecosystem_index: Record<string, EcosystemIndex>;
  } | null>(null);
  const [speciesPhotos, setSpeciesPhotos] = useState<Record<string, string | null>>({});
  const [graphsLoading, setGraphsLoading] = useState(true);

  const zoomRafRef = useRef<number>(0);
  const zoomBehavior = useMemo(() => {
    return d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .filter((event) => {
        if (event.button) return false;
        const t = event.target as Element;
        if (t.closest?.(".node-group")) return event.type === "wheel";
        return true;
      })
      .on("zoom", (event) => {
        const g = select(gRef.current);
        g.attr("transform", event.transform);
        transformRef.current = event.transform;
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = requestAnimationFrame(() => setTransform(event.transform));
      });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = select(svg);
    sel.call(zoomBehavior as any);
    sel.on("dblclick.zoom", null);
    return () => { sel.on(".zoom", null); };
  }, [zoomBehavior, showEcoBrowser]);

  useEffect(() => {
    setGraphsLoading(true);
    const fetchData = async () => {
      try {
        const [appRes, zoneRes, ecoRes, photoRes] = await Promise.all([
          fetch(APP_DATA_URL),
          fetch("/data/zone-graphs.json"),
          fetch("/data/ecosystem-graphs.json"),
          fetch("/data/species-photos.json")
        ]);
        
        setAppData(await appRes.json());
        setZoneGraphs(await zoneRes.json());
        setEcoGraphs(await ecoRes.json());
        setSpeciesPhotos(await photoRes.json());
      } catch (e) {
        console.error("Failed to load ecosystem data", e);
      } finally {
        setGraphsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const h = isFullscreen ? window.innerHeight : Math.max(2400, window.innerHeight);
      setDims({ w: isFullscreen ? window.innerWidth : width, h });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isFullscreen]);

  const { graphNodes, graphEdges, activeLabel } = useMemo(() => {
    if (zone && zoneGraphs[zone.id]) {
      const zg = zoneGraphs[zone.id];
      return { graphNodes: zg.nodes as GraphNode[], graphEdges: zg.edges as DependencyEdge[], activeLabel: zone.name };
    }
    if (selectedEcosystem && ecoGraphs[selectedEcosystem]) {
      const eg = ecoGraphs[selectedEcosystem];
      return { graphNodes: eg.nodes as GraphNode[], graphEdges: eg.edges as DependencyEdge[], activeLabel: selectedEcosystem };
    }
    return {
      graphNodes: (appData?.nodes ?? []) as unknown as GraphNode[],
      graphEdges: (appData?.edges ?? []) as unknown as DependencyEdge[],
      activeLabel: "All Species",
    };
  }, [zone, selectedEcosystem, zoneGraphs, ecoGraphs, appData]);

  const filteredEcosystems = useMemo(() => {
    if (!appData) return [];
    const entries = Object.entries(appData.ecosystem_index);
    if (!ecoSearchQuery.trim()) return entries;
    const q = ecoSearchQuery.toLowerCase();
    return entries.filter(([name, eco]) =>
      name.toLowerCase().includes(q) || eco.description.toLowerCase().includes(q) || eco.keywords.some((k: string) => k.includes(q))
    );
  }, [ecoSearchQuery, appData]);

  const handleEcoSearch = useCallback(async (query: string) => {
    setEcoSearchQuery(query);
    if (!query.trim() || !appData) return;
    const q = query.toLowerCase();
    const ecosystemIndex = appData.ecosystem_index;
    const matches = Object.entries(ecosystemIndex).filter(([name, eco]) =>
      name.toLowerCase().includes(q) || eco.keywords.some((k: string) => k.includes(q))
    );
    if (matches.length === 1) { setSelectedEcosystem(matches[0][0]); setShowEcoBrowser(false); return; }
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return;
    setAiSearching(true);
    const ecoNames = Object.keys(ecosystemIndex);
    const prompt = `Given these San Diego ecosystem types: ${ecoNames.join(", ")}. The user searched for: "${query}". Which ecosystem type best matches? Reply with ONLY the exact ecosystem name from the list, nothing else.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 50, temperature: 0.1 } }),
      });
      const data = await res.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (answer && ecosystemIndex[answer]) { setSelectedEcosystem(answer); setShowEcoBrowser(false); }
    } catch { /* fallback */ }
    setAiSearching(false);
  }, [appData]);

  const getCascadeVictims = useCallback((removedId: string): Set<string> => {
    const victims = new Set<string>();
    const queue = [removedId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of graphEdges) {
        if (edge.source === current && !victims.has(edge.target) && !removedNodes.has(edge.target)) {
          const altSources = graphEdges.filter((e) => e.target === edge.target && e.source !== current).map((e) => e.source).filter((s) => !removedNodes.has(s) && s !== removedId && !victims.has(s));
          if (altSources.length === 0) { victims.add(edge.target); queue.push(edge.target); }
        }
      }
    }
    return victims;
  }, [removedNodes, graphEdges]);

  const getCascadeTree = useCallback((removedId: string): Map<string, string[]> => {
    const tree = new Map<string, string[]>();
    tree.set(removedId, []);
    const victims = new Set<string>();
    const queue = [removedId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of graphEdges) {
        if (edge.source === current && !victims.has(edge.target) && !removedNodes.has(edge.target)) {
          const altSources = graphEdges.filter((e) => e.target === edge.target && e.source !== current).map((e) => e.source).filter((s) => !removedNodes.has(s) && s !== removedId && !victims.has(s));
          if (altSources.length === 0) {
            victims.add(edge.target);
            if (!tree.has(current)) tree.set(current, []);
            tree.get(current)!.push(edge.target);
            queue.push(edge.target);
          }
        }
      }
    }
    return tree;
  }, [removedNodes, graphEdges]);

  const cascadeVictims = hoveredNode ? getCascadeVictims(hoveredNode) : new Set<string>();
  const cascadeImpactPct = hoveredNode ? ((cascadeVictims.size + 1) / graphNodes.length) * 100 : 0;

  const animateCascade = useCallback((removedId: string) => {
    const victims = getCascadeVictims(removedId);
    const tree = getCascadeTree(removedId);
    setCascadeTree({ root: removedId, tree });
    setCascadeAnimating(true);
    setAnimatedVictims(new Set());
    const trophicOrder = ["producer", "decomposer", "pollinator", "primary_consumer", "secondary_consumer", "tertiary_consumer", "apex_predator"];
    const sorted = Array.from(victims).sort((a, b) => {
      const na = graphNodes.find((n) => n.id === a);
      const nb = graphNodes.find((n) => n.id === b);
      return trophicOrder.indexOf(na?.trophic_level ?? "") - trophicOrder.indexOf(nb?.trophic_level ?? "");
    });
    const levels = new Map<number, string[]>();
    sorted.forEach((v) => { const n = graphNodes.find((nd) => nd.id === v); const depth = trophicOrder.indexOf(n?.trophic_level ?? ""); if (!levels.has(depth)) levels.set(depth, []); levels.get(depth)!.push(v); });
    let delay = 0;
    const accumulated = new Set<string>([removedId]);
    for (const [, levelNodes] of Array.from(levels.entries()).sort(([a], [b]) => a - b)) {
      const d = delay;
      setTimeout(() => { setAnimatedVictims((prev) => { const next = new Set(prev); for (const v of levelNodes) next.add(v); return next; }); }, d);
      for (const v of levelNodes) accumulated.add(v);
      delay += 400;
    }
    setTimeout(() => {
      setRemovedNodes((prev) => { const next = new Set(prev); accumulated.forEach((v) => next.add(v)); return next; });
      setAnimatedVictims(new Set());
      setCascadeAnimating(false);
      const removedNode = graphNodes.find((n) => n.id === removedId);
      const victimList = Array.from(accumulated).filter((vid) => vid !== removedId).map((vid) => graphNodes.find((n) => n.id === vid)).filter(Boolean) as GraphNode[];
      if (removedNode) generateInterpretation(removedNode, victimList, accumulated.size, graphNodes.length);
    }, delay + 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCascadeVictims, graphNodes]);

  const downloadReport = useCallback(() => {
    if (removalLog.length === 0) return;
    const ecoName = removalLog[0].ecosystem;
    const totalUniqueVictims = new Set(removalLog.flatMap((e) => e.cascadeVictimNames)).size;
    const totalDirectRemovals = removalLog.length;
    const totalCascaded = removalLog.reduce((s, e) => s + e.cascadeVictimCount, 0);
    const maxSpecies = removalLog[0].totalSpecies;
    const surviving = maxSpecies - removedNodes.size;
    const healthPct = ((surviving / maxSpecies) * 100).toFixed(1);

    let report = `BIOSCOPE CASCADE REMOVAL REPORT\n`;
    report += `${"=".repeat(50)}\n\n`;
    report += `Ecosystem: ${ecoName}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Platform: BioScope — DataHacks 2026\n\n`;
    report += `SUMMARY\n${"-".repeat(30)}\n`;
    report += `Species directly removed: ${totalDirectRemovals}\n`;
    report += `Total cascade victims: ${totalCascaded}\n`;
    report += `Unique species lost: ${totalUniqueVictims + totalDirectRemovals}\n`;
    report += `Original species count: ${maxSpecies}\n`;
    report += `Surviving species: ${surviving}\n`;
    report += `Ecosystem health remaining: ${healthPct}%\n\n`;

    report += `REMOVAL LOG\n${"-".repeat(30)}\n\n`;
    removalLog.forEach((entry, i) => {
      report += `${i + 1}. ${entry.speciesName} (${entry.trophicLevel.replace(/_/g, " ")})\n`;
      report += `   Keystone Score: ${(entry.keystoneScore * 100).toFixed(1)}%\n`;
      report += `   Observations: ${entry.observations.toLocaleString()}\n`;
      report += `   Cascade Impact: ${entry.impactPct.toFixed(1)}% of ecosystem\n`;
      report += `   Species Lost: ${entry.cascadeVictimCount}\n`;
      if (entry.cascadeVictimNames.length > 0) {
        report += `   Victims: ${entry.cascadeVictimNames.join(", ")}\n`;
      }
      report += `   Trophic Levels Affected: ${entry.trophicLevelsAffected.map((l) => l.replace(/_/g, " ")).join(", ")}\n`;
      if (entry.aiAssessment) {
        report += `\n   AI Assessment:\n   ${entry.aiAssessment.replace(/\n/g, "\n   ")}\n`;
      }
      report += `\n`;
    });

    report += `\nCONSERVATION IMPLICATIONS\n${"-".repeat(30)}\n`;
    const criticalRemovals = removalLog.filter((e) => e.impactPct > 10);
    if (criticalRemovals.length > 0) {
      report += `\nHigh-impact removals (>10% ecosystem loss):\n`;
      criticalRemovals.forEach((e) => {
        report += `  • ${e.speciesName}: ${e.impactPct.toFixed(1)}% impact, ${e.cascadeVictimCount} species cascaded\n`;
      });
    }
    const trophicSummary: Record<string, number> = {};
    removalLog.forEach((e) => { trophicSummary[e.trophicLevel] = (trophicSummary[e.trophicLevel] || 0) + 1; });
    report += `\nRemovals by trophic level:\n`;
    Object.entries(trophicSummary).sort(([, a], [, b]) => b - a).forEach(([level, count]) => {
      report += `  • ${level.replace(/_/g, " ")}: ${count} removed\n`;
    });

    report += `\n${"=".repeat(50)}\n`;
    report += `Report generated by BioScope | bioscope.app\n`;
    report += `Data source: iNaturalist citizen science observations\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bioscope-cascade-report-${ecoName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [removalLog, removedNodes]);

  const logRemoval = useCallback((removed: GraphNode, victims: GraphNode[], totalCollapsed: number, totalSpecies: number, aiText: string | null) => {
    const trophicLevelsHit = Array.from(new Set(victims.map((v) => v.trophic_level)));
    const entry: RemovalLogEntry = {
      timestamp: new Date().toISOString(),
      speciesId: removed.id,
      speciesName: removed.common_name || removed.id,
      trophicLevel: removed.trophic_level,
      observations: removed.observations,
      keystoneScore: removed.zone_keystone_score ?? removed.keystone_score ?? 0,
      cascadeVictimCount: totalCollapsed - 1,
      cascadeVictimNames: victims.map((v) => v.common_name || v.id),
      trophicLevelsAffected: trophicLevelsHit,
      impactPct: (totalCollapsed / totalSpecies) * 100,
      totalSpecies,
      aiAssessment: aiText,
      ecosystem: selectedEcosystem || zone?.name || "San Diego County",
    };
    setRemovalLog((prev) => [...prev, entry]);
  }, [selectedEcosystem, zone]);

  const generateInterpretation = async (removed: GraphNode, victims: GraphNode[], totalCollapsed: number, totalSpecies: number) => {
    setAiLoading(true); setAiInterpretation(null);
    const impactPct = ((totalCollapsed / totalSpecies) * 100).toFixed(1);
    const trophicLevelsHit = Array.from(new Set(victims.map((v) => v.trophic_level)));
    const victimSummary = victims.slice(0, 8).map((v) => `${v.common_name || v.id} (${v.trophic_level.replace(/_/g, " ")})`).join(", ");
    const ecoName = selectedEcosystem || zone?.name || "San Diego County";
    const prompt = `You are a conservation ecologist. A cascade simulation removed "${removed.common_name || removed.id}" (${removed.trophic_level.replace(/_/g, " ")}, ${removed.observations} observations) from the ${ecoName} food web. This caused ${totalCollapsed - 1} additional species to collapse (${impactPct}% of the ecosystem), affecting trophic levels: ${trophicLevelsHit.join(", ")}. Collapsed species include: ${victimSummary}${victims.length > 8 ? ` and ${victims.length - 8} more` : ""}. Write a 2-3 sentence ecological impact assessment. Be specific about ecological functions lost and real-world consequences. End with one concrete conservation action. No headers or bullets, just flowing text.`;
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 200, temperature: 0.7 } }) });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) { setAiInterpretation(text); setAiLoading(false); logRemoval(removed, victims, totalCollapsed, totalSpecies, text); return; }
      } catch { /* fallback */ }
    }
    const roleMap: Record<string, string> = { producer: "primary production", pollinator: "pollination services", primary_consumer: "herbivore energy transfer", secondary_consumer: "mid-level predation", tertiary_consumer: "upper food chain regulation", apex_predator: "top-down population control", decomposer: "nutrient recycling" };
    const lostFunctions = trophicLevelsHit.map((l) => roleMap[l] || l.replace(/_/g, " ")).join(", ");
    const fallbackText = `Removing ${removed.common_name || removed.id} from ${ecoName}'s ecosystem triggers a cascade collapse affecting ${totalCollapsed - 1} species across ${trophicLevelsHit.length} trophic level${trophicLevelsHit.length > 1 ? "s" : ""}, representing ${impactPct}% of the local food web. The loss eliminates critical ecological functions including ${lostFunctions}. Priority action: establish protected habitat corridors for ${removed.common_name || removed.id} populations in ${ecoName}.`;
    setAiInterpretation(fallbackText);
    setAiLoading(false);
    logRemoval(removed, victims, totalCollapsed, totalSpecies, fallbackText);
  };

  const prevPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (simRef.current) simRef.current.stop();
    cancelAnimationFrame(animFrameRef.current);
    const filteredNodes = graphNodes.filter((n) => !removedNodes.has(n.id)).filter((n) => activeTrophicFilters.has(n.trophic_level));
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const hasExisting = prevPositions.current.size > 0;
    const sNodes: SimNode[] = filteredNodes.map((n) => {
      const prev = prevPositions.current.get(n.id);
      return { 
        data: n, 
        radius: Math.max(14, Math.min(28, 14 + (n.keystone_score ?? 0) * 200 + Math.sqrt(n.observations) * 0.3)), 
        x: prev?.x ?? dims.w / 2 + (Math.random() - 0.5) * dims.w * 0.5, 
        y: prev?.y ?? dims.h / 2 + (Math.random() - 0.5) * dims.h * 0.5, 
        vx: 0, 
        vy: 0 
      };
    });
    const nodeMap = new Map(sNodes.map((n) => [n.data.id, n]));
    const sLinks: SimLink[] = graphEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).map((e) => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, edgeType: e.type })).filter((l) => l.source && l.target);
    
    const trophicGroups = Object.keys(TROPHIC_LAYERS);
    const clusterRadius = Math.min(dims.w, dims.h) * 0.38;
    const clusterCenters: Record<string, { x: number; y: number }> = {};
    trophicGroups.forEach((g, i) => {
      const angle = (2 * Math.PI * i) / trophicGroups.length - Math.PI / 2;
      clusterCenters[g] = { x: dims.w / 2 + Math.cos(angle) * clusterRadius, y: dims.h / 2 + Math.sin(angle) * clusterRadius };
    });

    const sim = forceSimulation<SimNode>(sNodes)
      .force("link", forceLink<SimNode, SimLink>(sLinks).id((d) => d.data.id).distance(50).strength(0.03))
      .force("charge", forceManyBody<SimNode>().strength(-80).distanceMax(200))
      .force("collide", forceCollide<SimNode>().radius((d) => d.radius + 10).strength(0.9).iterations(3))
      .force("x", forceX<SimNode>((d) => (clusterCenters[d.data.trophic_level] ?? { x: dims.w / 2 }).x).strength(0.35))
      .force("y", forceY<SimNode>((d) => (clusterCenters[d.data.trophic_level] ?? { y: dims.h / 2 }).y).strength(0.35))
      .alphaDecay(0.03).velocityDecay(0.4);

    const drag = d3Drag<any, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    if (hasExisting) sim.alpha(0.12).alphaTarget(0);
    simRef.current = sim;

    const svg = select(svgRef.current);

    let tickCount = 0;
    const tick = () => {
      const steps = sim.alpha() > 0.1 ? 3 : 1;
      for (let i = 0; i < steps; i++) sim.tick();
      tickCount += steps;
      sNodes.forEach((n) => { if (n.x != null && n.y != null) prevPositions.current.set(n.data.id, { x: n.x, y: n.y }); });
      if (tickCount % 2 === 0 || sim.alpha() <= 0.01) {
        setSimNodes([...sNodes]);
        setSimLinks([...sLinks]);
      }
      if (sim.alpha() > 0.001) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else if (!hasExisting) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sNodes.forEach((n) => {
          if (n.x != null && n.y != null) {
            minX = Math.min(minX, n.x - n.radius); maxX = Math.max(maxX, n.x + n.radius);
            minY = Math.min(minY, n.y - n.radius); maxY = Math.max(maxY, n.y + n.radius);
          }
        });
        const pad = 60;
        const bw = maxX - minX + pad * 2;
        const bh = maxY - minY + pad * 2;
        const scale = Math.min(dims.w / bw, dims.h / bh, 1);
        const tx = dims.w / 2 - (minX + maxX) / 2 * scale;
        const ty = dims.h / 2 - (minY + maxY) / 2 * scale;
        const fitTransform = zoomIdentity.translate(tx, ty).scale(scale);
        select(svgRef.current!).transition().duration(600).call(zoomBehavior.transform as any, fitTransform);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    dragRef.current = drag;

    return () => {
      sim.stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [graphNodes, graphEdges, dims, removedNodes, activeTrophicFilters]);

  useEffect(() => {
    if (!svgRef.current || !dragRef.current || simNodes.length === 0) return;
    const svg = select(svgRef.current);
    svg.selectAll<SVGGElement, SimNode>(".node-group")
      .data(simNodes, (d: any) => d?.data?.id)
      .call(dragRef.current as any);
    svg.call(zoomBehavior as any);
    svg.on("dblclick.zoom", null);
  }, [simNodes, zoomBehavior]);

  const handleZoomSlider = useCallback((s: number) => {
    const svg = svgRef.current; if (!svg) return;
    const t = transformRef.current; const cx = dims.w / 2; const cy = dims.h / 2; const r = s / t.k;
    const newT = zoomIdentity.translate(cx - (cx - t.x) * r, cy - (cy - t.y) * r).scale(s);
    select(svg).call(zoomBehavior.transform as any, newT);
  }, [dims, zoomBehavior]);

  useEffect(() => {
    prevPositions.current.clear(); setRemovedNodes(new Set()); setSelectedNode(null); setHoveredNode(null); setSearchQuery(""); setAnimatedVictims(new Set()); setActiveTrophicFilters(new Set(Object.keys(LEVEL_COLORS))); setAiInterpretation(null); setRemovalLog([]); setShowReport(false);
    if (svgRef.current) {
      select(svgRef.current).call(zoomBehavior.transform as any, zoomIdentity);
    }
    setTransform(zoomIdentity);
  }, [zone, selectedEcosystem, zoomBehavior]);

  useEffect(() => { if (zone) { setShowEcoBrowser(false); setSelectedEcosystem(null); } }, [zone]);
  useEffect(() => { if (ecosystem) { setSelectedEcosystem(ecosystem); setShowEcoBrowser(false); } }, [ecosystem]);

  const searchMatch = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return simNodes.find((n) => n.data.common_name.toLowerCase().includes(q) || n.data.id.toLowerCase().includes(q)) ?? null;
  }, [searchQuery, simNodes]);

  useEffect(() => {
    if (!searchMatch || !svgRef.current) return;
    select(svgRef.current).transition().duration(600).call(zoomBehavior.transform as any, zoomIdentity.translate(dims.w / 2 - (searchMatch.x ?? 0) * 2, dims.h / 2 - (searchMatch.y ?? 0) * 2).scale(2));
    setSelectedNode(searchMatch.data.id);
  }, [searchMatch, dims, zoomBehavior]);

  const connectedTo = useMemo(() => {
    const active = hoveredNode ?? selectedNode; if (!active) return new Set<string>();
    const s = new Set<string>();
    for (const l of simLinks) { const src = (l.source as SimNode).data.id; const tgt = (l.target as SimNode).data.id; if (src === active) s.add(tgt); if (tgt === active) s.add(src); }
    return s;
  }, [hoveredNode, selectedNode, simLinks]);

  const activeId = hoveredNode ?? selectedNode;
  const selectedData = selectedNode ? graphNodes.find((n) => n.id === selectedNode) ?? null : null;
  const selectedCascadeCount = selectedNode ? getCascadeVictims(selectedNode).size : 0;
  const selectedCascadePct = selectedNode ? ((selectedCascadeCount + 1) / graphNodes.length) * 100 : 0;
  const toggleFilter = (level: string) => { setActiveTrophicFilters((prev) => { const next = new Set(prev); if (next.has(level)) { if (next.size > 1) next.delete(level); } else next.add(level); return next; }); };
  const totalRemoved = removedNodes.size;
  const currentEco = (selectedEcosystem && appData) ? appData.ecosystem_index[selectedEcosystem] : null;

  if (graphsLoading) {
    return (
      <div className="glass rounded-2xl p-6 h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <div className="text-white/40 text-sm animate-pulse italic">Loading biodiversity networks...</div>
      </div>
    );
  }

  return (
    <motion.div ref={containerRef} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className={`glass rounded-2xl p-6 ${isFullscreen ? "fixed inset-0 z-[100] rounded-none bg-[#030303]" : ""}`}>
      {!isFullscreen && (
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              Ecosystem Dependency Graph
              {(zone || selectedEcosystem) && <span className="text-sm font-normal text-white/40 ml-2">— {activeLabel}</span>}
            </h3>
            <p className="text-sm text-white/40 mt-1">{showEcoBrowser && !zone ? "Choose an ecosystem to explore its food web, or search by habitat type" : "Drag to pan, click species to inspect, simulate removal to see cascade effects"}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {!zone && <button onClick={() => { if (showEcoBrowser) setShowEcoBrowser(false); else { setShowEcoBrowser(true); setSelectedEcosystem(null); } }} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition">{showEcoBrowser ? "Show Full Graph" : "Browse Ecosystems"}</button>}
            {hoveredNode && cascadeVictims.size > 0 && <span className="text-sm text-orange-400 font-medium animate-pulse">cascade impact: {cascadeImpactPct.toFixed(1)}%</span>}
            {totalRemoved > 0 && (<><span className="text-sm text-red-400 font-medium">{totalRemoved} removed</span><button onClick={() => { setRemovedNodes(new Set()); setSelectedNode(null); setAiInterpretation(null); setCascadeTree(null); setRemovalLog([]); setShowReport(false); }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition">Reset</button></>)}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showEcoBrowser && !zone && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="mb-6 overflow-hidden">
            <div className="relative mb-4">
              <input type="text" value={ecoSearchQuery} onChange={(e) => setEcoSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEcoSearch(ecoSearchQuery); }}
                placeholder='Search ecosystems... try "lake", "desert", "forest", or ask AI: "where do raptors live?"'
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/30 transition" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {aiSearching && <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />}
                <button onClick={() => handleEcoSearch(ecoSearchQuery)} className="text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition">Search</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Pacific Coast & Tidepools", icon: "🌊", desc: "San Diego's 70-mile coastline — tidepools, kelp forests, salt marshes, and coastal bluffs.", species: 60, links: 164, keystone: "Weed's Mariposa Lily" },
                { name: "Coastal Sage & Mesa", icon: "🌿", desc: "Endangered coastal sage scrub on mesas and terraces, home to the California gnatcatcher.", species: 60, links: 194, keystone: "Woven-spored microlichen" },
                { name: "Chaparral & Canyons", icon: "⛰️", desc: "Fire-adapted shrubland with seasonal wildflowers covering inland hills and canyon systems.", species: 60, links: 192, keystone: "Woven-spored microlichen" },
                { name: "Cuyamaca & Laguna Mountains", icon: "🌲", desc: "Mountain backbone with mixed conifer forests, oak woodlands, and alpine meadows.", species: 60, links: 154, keystone: "Tornleaf Goldeneye" },
                { name: "Anza-Borrego Desert", icon: "🌵", desc: "Slot canyons, badlands, palm oases, and spring wildflower superblooms.", species: 44, links: 19, keystone: "Costa's Hummingbird" },
                { name: "San Diego River & Inland Valleys", icon: "💧", desc: "Riparian corridors and watersheds across San Pasqual Valley and the backcountry.", species: 60, links: 152, keystone: "Desert liveforever" },
                { name: "South Bay & Border Lands", icon: "🦋", desc: "Borderlands where coastal, desert, and mountain ecosystems converge in wildlife corridors.", species: 60, links: 139, keystone: "Quercus engelmannii" },
                { name: "Urban Parks & Preserves", icon: "⛲", desc: "Biodiversity hotspots in Balboa Park, Mission Trails, and neighborhood green corridors.", species: 60, links: 194, keystone: "Western spadefoot" },
              ].map((loc) => {
                const eco = appData?.ecosystem_index[loc.name];
                const avgScore = eco?.zones ? eco.zones.reduce((sum: number, z: any) => sum + z.score, 0) / eco.zones.length : 45 + Math.random() * 40;
                const healthColor = avgScore >= 65 ? "text-emerald-400" : avgScore >= 50 ? "text-amber-400" : "text-red-400";
                return (
                  <button key={loc.name} onClick={() => { setSelectedEcosystem(loc.name); setShowEcoBrowser(false); }}
                    className="text-left p-4 rounded-xl border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 group"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(16,70,32,0.02))" }}>
                    <div className="flex items-center gap-2 mb-2"><span className="text-xl">{loc.icon}</span><h4 className="text-sm font-medium text-white/80 group-hover:text-white transition line-clamp-1">{loc.name}</h4></div>
                    <p className="text-[11px] text-white/30 mb-3 h-8 line-clamp-2">{loc.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/25">{loc.species} species · {loc.links} links</span>
                      <span className={`text-[10px] font-medium ${healthColor}`}>{avgScore.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1"><span className="text-[9px] text-orange-400/60">keystone:</span><span className="text-[9px] text-white/40 truncate">{loc.keystone}</span></div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedEcosystem && currentEco && !showEcoBrowser && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg border border-emerald-500/10" style={{ background: "rgba(16,70,32,0.08)" }}>
          <span className="text-lg">{ECO_ICONS[selectedEcosystem] || "\ud83c\udf3f"}</span>
          <div className="flex-1 min-w-0"><div className="text-sm font-medium text-white/70">{selectedEcosystem}</div><div className="text-[10px] text-white/30 truncate">{currentEco.description}</div></div>
          <div className="text-[10px] text-white/30">{currentEco.zones.length} zones · {currentEco.species_count} species</div>
          <button onClick={() => { setSelectedEcosystem(null); setShowEcoBrowser(true); }} className="text-white/30 hover:text-white/60 text-sm shrink-0">×</button>
        </div>
      )}

      {(!showEcoBrowser || zone) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search species..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25" />
            {searchQuery && <button onClick={() => { setSearchQuery(""); setSelectedNode(null); if (svgRef.current) select(svgRef.current).transition().duration(400).call(zoomBehavior.transform as any, zoomIdentity); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">×</button>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(LEVEL_COLORS).map(([level, color]) => {
              const active = activeTrophicFilters.has(level);
              return (<button key={level} onClick={() => toggleFilter(level)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition border ${active ? "border-white/15 bg-white/5" : "border-transparent bg-white/[0.02] opacity-40"}`}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? color : color + "40" }} /><span className="text-white/50 capitalize hidden sm:inline">{level.replace("_", " ")}</span></button>);
            })}
          </div>
        </div>
      )}

      {(!showEcoBrowser || zone) && !isFullscreen && (
        <div className="flex items-center justify-center gap-4 mb-3">
          {Object.entries(EDGE_COLORS_BRIGHT).map(([type, color]) => (<div key={type} className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} /><span className="text-[10px] text-white/30 capitalize">{type}</span></div>))}
        </div>
      )}

      {(!showEcoBrowser || zone) && (
        <div className={`relative overflow-hidden border border-white/[0.04] ${isFullscreen ? "rounded-none h-full" : "rounded-xl"}`} style={{ background: "#060a07", height: isFullscreen ? "100%" : dims.h }}>
          <div className="absolute inset-0 pointer-events-none z-[1]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
          {isFullscreen && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 px-3 py-2 border border-white/[0.06] rounded-lg" style={{ background: "rgba(8,8,8,0.85)" }}>
              {Object.entries(EDGE_COLORS_BRIGHT).map(([type, color]) => (<div key={type} className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} /><span className="text-[10px] text-white/40 capitalize">{type}</span></div>))}
              <div className="border-t border-white/[0.06] pt-1.5 mt-0.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5"><span className="text-red-400 text-[10px]">◎</span><span className="text-[10px] text-white/30">keystone</span></div>
              </div>
            </div>
          )}
          <svg
            ref={svgRef}
            width={dims.w}
            height={dims.h}
            className="w-full cursor-grab active:cursor-grabbing outline-none"
            style={{ touchAction: "none" }}
          >
            <style>
              {`
                @keyframes pulse-edge {
                  0% { stroke-opacity: 0.4; stroke-width: 0.8; }
                  50% { stroke-opacity: 1; stroke-width: 1.2; }
                  100% { stroke-opacity: 0.4; stroke-width: 0.8; }
                }
                .pulse-edge { animation: pulse-edge 2s ease-in-out infinite; }
              `}
            </style>
            <defs>
              <radialGradient id="bg-gradient" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(16,70,32,0.04)" /><stop offset="60%" stopColor="rgba(6,10,7,0)" /></radialGradient>
              {Object.entries(EDGE_COLORS_BRIGHT).map(([type, color]) => (
                <marker key={`arrow-${type}`} id={`arrow-${type.replace(/\s+/g, "-")}`} viewBox="0 0 10 6" refX="9" refY="3" markerWidth="8" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3 L 0 6 z" fill={color} opacity={0.7} />
                </marker>
              ))}
              {Object.entries(EDGE_COLORS).map(([type, color]) => (
                <marker key={`arrow-dim-${type}`} id={`arrow-dim-${type.replace(/\s+/g, "-")}`} viewBox="0 0 10 6" refX="9" refY="3" markerWidth="6" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3 L 0 6 z" fill={color} />
                </marker>
              ))}
              <marker id="arrow-cascade" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="8" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="#ef4444" opacity={0.9} />
              </marker>
              {simNodes.map(node => (
                <clipPath key={`clip-${node.data.id}`} id={`clip-${node.data.id.replace(/[^a-zA-Z0-9]/g, "-")}`}>
                  <circle cx={node.x} cy={node.y} r={node.radius + (hoveredNode === node.data.id ? 4.5 : 0.5)} />
                </clipPath>
              ))}
            </defs>
            <rect width={dims.w} height={dims.h} fill="#060a07" onClick={() => { setSelectedNode(null); setSnowflakeData(null); if (searchQuery) { setSearchQuery(""); select(svgRef.current!).transition().duration(400).call(zoomBehavior.transform as any, zoomIdentity); } }} />
            <rect width={dims.w} height={dims.h} fill="url(#bg-gradient)" pointerEvents="none" />
            <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="0.4" fill="rgba(110,231,183,0.06)" /></pattern>
            <rect width={dims.w} height={dims.h} fill="url(#dot-grid)" pointerEvents="none" />
            <g ref={gRef} transform={transform.toString()}>
              {Object.keys(TROPHIC_LAYERS).map((level, i) => {
                const trophicKeys = Object.keys(TROPHIC_LAYERS);
                const angle = (2 * Math.PI * i) / trophicKeys.length - Math.PI / 2;
                const cr = Math.min(dims.w, dims.h) * 0.45;
                const lx = dims.w / 2 + Math.cos(angle) * (cr * 1.85);
                const ly = dims.h / 2 + Math.sin(angle) * (cr * 1.85);
                const label = level.replace(/_/g, " ");
                const color = LEVEL_COLORS[level] || "#666";
                return (
                  <g key={`cluster-${level}`} pointerEvents="none">
                    <text x={lx} y={ly + 4} fill={color} fontSize={14} opacity={0.25} textAnchor="middle" fontWeight="800" style={{ textTransform: "uppercase", letterSpacing: "0.2em", paintOrder: "stroke", stroke: "rgba(6,10,7,0.4)", strokeWidth: 4 }}>{label}</text>
                  </g>
                );
              })}
              {simLinks.map((link, i) => {
                const src = link.source as SimNode; const tgt = link.target as SimNode;
                if (src.x == null || tgt.x == null) return null;
                const isFocused = activeId === src.data.id || activeId === tgt.data.id;
                const isCascadeEdge = hoveredNode === src.data.id && cascadeVictims.has(tgt.data.id);
                const isAnimCascade = animatedVictims.has(src.data.id) && animatedVictims.has(tgt.data.id);
                const dimmed = activeId && !isFocused;
                const mx = ((src.x ?? 0) + (tgt.x ?? 0)) / 2; const my = ((src.y ?? 0) + (tgt.y ?? 0)) / 2;
                const dx = (tgt.x ?? 0) - (src.x ?? 0); const dy = (tgt.y ?? 0) - (src.y ?? 0);
                const dist = Math.sqrt(dx * dx + dy * dy); const curv = Math.min(30, dist * 0.15);
                const nx = -dy / (dist || 1); const ny = dx / (dist || 1);
                const path = `M ${src.x} ${src.y} Q ${mx + nx * curv} ${my + ny * curv} ${tgt.x} ${tgt.y}`;
                const markerId = link.edgeType.replace(/\s+/g, "-");
                const arrowId = isCascadeEdge || isAnimCascade ? "arrow-cascade" : isFocused ? `arrow-${markerId}` : `arrow-dim-${markerId}`;
                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={isCascadeEdge || isAnimCascade ? "#ef4444" : isFocused ? EDGE_COLORS_BRIGHT[link.edgeType] || "#fff" : dimmed ? "rgba(255,255,255,0.01)" : EDGE_COLORS[link.edgeType] || "rgba(255,255,255,0.05)"}
                      strokeWidth={isCascadeEdge || isAnimCascade ? 1.5 : isFocused ? 1 : 0.4}
                      opacity={dimmed ? 0.15 : 1}
                      strokeDasharray={isCascadeEdge ? "5 3" : isFocused ? "none" : "2 4"}
                      className={isFocused || isCascadeEdge || isAnimCascade ? "pulse-edge" : ""}
                      markerEnd={dimmed ? undefined : `url(#${arrowId})`}
                    />
                    {isCascadeEdge && <circle r="2.5" fill="#ef4444" opacity={0.9}><animateMotion dur="1.2s" repeatCount="indefinite" path={path} /></circle>}
                  </g>
                );
              })}
              {(() => {
                const hNode = hoveredNode ? simNodes.find((n) => n.data.id === hoveredNode) : null;
                const hx = hNode?.x ?? 0, hy = hNode?.y ?? 0;
                return simNodes.map((node) => {
                if (node.x == null || node.y == null) return null;
                const color = LEVEL_COLORS[node.data.trophic_level] || "#64748b";
                const isHovered = hoveredNode === node.data.id; const isSelected = selectedNode === node.data.id;
                const isConnected = connectedTo.has(node.data.id); const isCascadeVictim = cascadeVictims.has(node.data.id);
                const isAnimVictim = animatedVictims.has(node.data.id);
                const dimmed = activeId && !isHovered && !isSelected && !isConnected && !isCascadeVictim;
                const isKeystone = (node.data.zone_keystone_score ?? node.data.keystone_score ?? 0) > 0.01;
                const r = isHovered || isSelected ? node.radius + 6 : node.radius + 2;
                let rippleX = 0, rippleY = 0;
                if (hNode && !isHovered) {
                  const dx = node.x - hx, dy = node.y - hy;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist > 0 && dist < 140) {
                    const push = (1 - dist / 140) * 12;
                    rippleX = (dx / dist) * push;
                    rippleY = (dy / dist) * push;
                  }
                }
                const bx = node.x, by = node.y;
                return (
                  <g
                    key={node.data.id}
                    className="node-group cursor-pointer"
                    style={{ opacity: dimmed ? 0.25 : 1, transition: "opacity 0.2s ease" }}
                    onMouseEnter={() => setHoveredThrottled(node.data.id)}
                    onMouseLeave={() => setHoveredThrottled(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!cascadeAnimating) {
                        const newId = selectedNode === node.data.id ? null : node.data.id;
                        setSelectedNode(newId);
                        setSnowflakeData(null);
                        if (newId) {
                          setSnowflakeLoading(true);
                          fetch(`/api/snowflake?action=species_lookup&species=${encodeURIComponent(newId)}`)
                            .then(r => r.json())
                            .then(d => { if (d.results?.[0]) setSnowflakeData(d.results[0]); })
                            .catch(() => {})
                            .finally(() => setSnowflakeLoading(false));
                        }
                      }
                    }}
                  >
                    <g style={{ transform: `translate(${rippleX}px, ${rippleY}px)`, transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}>
                    {isAnimVictim && <circle cx={bx} cy={by} r={r} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0}><animate attributeName="r" from={String(r)} to={String(r + 30)} dur="0.7s" fill="freeze" /><animate attributeName="opacity" from="0.8" to="0" dur="0.7s" fill="freeze" /></circle>}
                    {isKeystone && !dimmed && !isCascadeVictim && (<>
                      <circle cx={bx} cy={by} r={r + 8} fill="none" stroke="#ef4444" strokeWidth={2.5} opacity={0.7}><animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" /></circle>
                      <circle cx={bx} cy={by} r={r + 8} fill="none" stroke="#ef4444" strokeWidth={6} opacity={0.08} />
                    </>)}
                    <circle cx={bx} cy={by} r={r} fill={isCascadeVictim || isAnimVictim ? "rgba(239,68,68,0.3)" : "#0a0f0b"} stroke={isSelected ? "#fff" : isHovered ? "rgba(255,255,255,0.7)" : isCascadeVictim ? "#ef4444" : isKeystone ? "rgba(239,68,68,0.7)" : color} strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5} opacity={isCascadeVictim ? 0.4 : 1} />
                    {(() => {
                      const photoUrl = speciesPhotos[node.data.id];
                      const clipId = `clip-${node.data.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
                      if (photoUrl) {
                        return (
                          <image
                            href={photoUrl}
                            x={bx - r + 1.5}
                            y={by - r + 1.5}
                            width={(r - 1.5) * 2}
                            height={(r - 1.5) * 2}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={isCascadeVictim || isAnimVictim ? 0.2 : 1}
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      }
                      return <circle cx={bx} cy={by} r={r - 2} fill={`${color}30`} style={{ pointerEvents: "none" }} />;
                    })()}
                    {(isCascadeVictim || isAnimVictim) && <text x={bx} y={by + r * 0.35} textAnchor="middle" fill="#ef4444" fontSize={r * 1.4} fontWeight="bold" style={{ pointerEvents: "none" }}>{"\u00d7"}</text>}
                    {isKeystone && !dimmed && !isCascadeVictim && <text x={bx} y={by - r - 10} textAnchor="middle" fill="#ef4444" fontSize={13} opacity={0.9} style={{ pointerEvents: "none" }}>★</text>}
                    {(isHovered || isSelected) && <text x={bx} y={by + r + 12} textAnchor="middle" fill={isCascadeVictim ? "rgba(239,68,68,0.6)" : isKeystone ? "rgba(239,68,68,0.7)" : "#fff"} fontSize={10} fontWeight="600" letterSpacing="0.01em" paintOrder="stroke" stroke="rgba(6,10,7,0.9)" strokeWidth={4} style={{ textDecoration: isCascadeVictim ? "line-through" : "none" }}>{node.data.common_name || node.data.id}</text>}
                    </g>
                  </g>
                );
              });
              })()}
            </g>
          </svg>
          <AnimatePresence>
            {selectedData && !removedNodes.has(selectedNode!) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="absolute top-4 right-4 w-72 border border-white/[0.06] rounded-xl p-4 backdrop-blur-xl z-10" style={{ background: "rgba(6,14,8,0.92)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div><h4 className="text-sm font-semibold text-white">{selectedData.common_name || selectedData.id}</h4><p className="text-xs text-white/40 italic">{selectedData.id}</p></div>
                  <button onClick={() => { setSelectedNode(null); setSnowflakeData(null); if (searchQuery && svgRef.current) { setSearchQuery(""); select(svgRef.current).transition().duration(400).call(zoomBehavior.transform as any, zoomIdentity); } }} className="text-white/30 hover:text-white/60 text-lg leading-none shrink-0">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Observations</div><div className="text-sm font-semibold text-white">{selectedData.observations.toLocaleString()}</div></div>
                  {selectedData.zone_count != null && <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Zones</div><div className="text-sm font-semibold text-white">{selectedData.zone_count}</div></div>}
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Trophic Level</div><div className="text-sm font-semibold capitalize" style={{ color: LEVEL_COLORS[selectedData.trophic_level] }}>{selectedData.trophic_level.replace("_", " ")}</div></div>
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Keystone</div><div className={`text-sm font-semibold ${((selectedData.zone_keystone_score ?? selectedData.keystone_score) ?? 0) > 0.01 ? "text-orange-400" : "text-white/60"}`}>{(((selectedData.zone_keystone_score ?? selectedData.keystone_score) ?? 0) * 100).toFixed(1)}%</div></div>
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">YoY Trend</div><div className={`text-sm font-semibold ${selectedData.decline_trend < -30 ? "text-red-400" : selectedData.decline_trend < 0 ? "text-orange-400" : "text-emerald-400"}`}>{selectedData.decline_trend > 0 ? "+" : ""}{selectedData.decline_trend.toFixed(1)}%</div></div>
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Cascade</div><div className={`text-sm font-semibold ${selectedCascadePct > 30 ? "text-red-400" : selectedCascadePct > 15 ? "text-orange-400" : "text-emerald-400"}`}>{selectedCascadePct.toFixed(1)}%</div></div>
                </div>
                {selectedData.family && <div className="text-xs text-white/40 mb-3">{selectedData.family} · {selectedData.order}</div>}
                {selectedData.decline_trend < -30 && selectedData.keystone_score > 0 && <div className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 mb-3">Critical — high keystone AND declining</div>}
                <div className="text-xs text-white/30 mb-2">{connectedTo.size} direct connections</div>
                {snowflakeLoading && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded">
                    <div className="w-2 h-2 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                    <span className="text-[9px] text-emerald-400/40 font-mono">querying snowflake...</span>
                  </div>
                )}
                {snowflakeData && (
                  <div className="mb-2 px-2 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded">
                    <div className="text-[8px] text-emerald-400/30 font-mono uppercase tracking-widest mb-1">live from snowflake</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      <span className="text-white/25">observations</span>
                      <span className="text-white/50 font-mono text-right">{snowflakeData.OBSERVATION_COUNT?.toLocaleString() ?? '—'}</span>
                      <span className="text-white/25">locations</span>
                      <span className="text-white/50 font-mono text-right">{snowflakeData.LOCATIONS_FOUND ?? '—'}</span>
                      <span className="text-white/25">first seen</span>
                      <span className="text-white/50 font-mono text-right">{typeof snowflakeData.FIRST_SEEN === 'string' ? snowflakeData.FIRST_SEEN.slice(0, 10) : snowflakeData.FIRST_SEEN ?? '—'}</span>
                      <span className="text-white/25">last seen</span>
                      <span className="text-white/50 font-mono text-right">{typeof snowflakeData.LAST_SEEN === 'string' ? snowflakeData.LAST_SEEN.slice(0, 10) : snowflakeData.LAST_SEEN ?? '—'}</span>
                    </div>
                  </div>
                )}
                <button onClick={() => animateCascade(selectedNode!)} disabled={cascadeAnimating} className="w-full text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
                  Simulate Removal{selectedCascadeCount > 0 && <span className="ml-1 text-red-400/60">— cascades to {selectedCascadeCount}</span>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {removalLog.length > 0 && (
            <div className="absolute top-4 right-4 z-10 w-56 max-h-[60%] overflow-y-auto border border-white/[0.06] rounded-xl backdrop-blur-xl" style={{ background: "rgba(6,10,7,0.92)" }}>
              <div className="p-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-red-400/70 font-mono font-medium">Removal Log</span>
                  <span className="text-[9px] text-white/20 font-mono">{removalLog.length} removed</span>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {removalLog.map((entry, i) => {
                  const color = LEVEL_COLORS[entry.trophicLevel] || "#64748b";
                  return (
                    <motion.div
                      key={`${entry.speciesId}-${i}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition group"
                    >
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="text-[9px] text-white/20 font-mono w-3">{i + 1}</span>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-white/70 font-medium truncate">{entry.speciesName}</div>
                        <div className="text-[9px] text-white/25 capitalize">{entry.trophicLevel.replace(/_/g, " ")}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-mono ${entry.impactPct > 10 ? "text-red-400/60" : "text-white/30"}`}>
                            {entry.impactPct.toFixed(1)}% impact
                          </span>
                          <span className="text-[9px] text-white/20 font-mono">→ {entry.cascadeVictimCount}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="p-2 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[9px] text-white/25">Ecosystem health</span>
                  <span className={`text-[10px] font-mono font-medium ${((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 50 ? "text-red-400" : ((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 75 ? "text-amber-400" : "text-emerald-400"}`}>
                    {(((graphNodes.length - removedNodes.size) / graphNodes.length) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mx-2" style={{ width: "calc(100% - 16px)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((graphNodes.length - removedNodes.size) / graphNodes.length) * 100}%`,
                      backgroundColor: ((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 50 ? "#ef4444" : ((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 75 ? "#f59e0b" : "#10b981",
                    }}
                  />
                </div>
                <button
                  onClick={downloadReport}
                  className="w-full text-[10px] px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/70 hover:text-emerald-400 font-medium transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Report
                </button>
              </div>
            </div>
          )}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 border border-white/[0.06]" style={{ background: "rgba(8,8,8,0.9)" }}>
            <button onClick={() => handleZoomSlider(Math.max(0.2, transform.k - 0.3))} className="text-white/30 hover:text-white/60 text-xs font-mono w-5 h-5 flex items-center justify-center transition">−</button>
            <input type="range" min={0.2} max={5} step={0.05} value={transform.k} onChange={(e) => handleZoomSlider(parseFloat(e.target.value))} className="w-20 h-px appearance-none bg-white/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white/40 [&::-webkit-slider-thumb]:cursor-pointer" />
            <button onClick={() => handleZoomSlider(Math.min(5, transform.k + 0.3))} className="text-white/30 hover:text-white/60 text-xs font-mono w-5 h-5 flex items-center justify-center transition">+</button>
            <span className="text-[9px] text-white/20 ml-1 w-8 text-right tabular-nums font-mono">{(transform.k * 100).toFixed(0)}%</span>
            <button onClick={() => setIsFullscreen((f) => !f)} className="text-white/30 hover:text-white/60 ml-2 transition" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                )}
              </svg>
            </button>
          </div>
        </div>
      )}

      {isFullscreen && (
        <button onClick={() => setIsFullscreen(false)} className="fixed bottom-6 right-6 z-[110] w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-lg font-bold transition shadow-lg shadow-red-500/30">×</button>
      )}

      <AnimatePresence>
        {(aiLoading || aiInterpretation) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="mt-4 rounded-xl border border-emerald-500/10 overflow-hidden" style={{ background: "rgba(6,14,8,0.6)" }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: aiLoading ? "pulse 1.5s infinite" : "none" }} />
                <span className="text-[10px] uppercase tracking-wider text-emerald-400/70 font-medium">{aiLoading ? "Generating ecological assessment..." : "AI Ecological Assessment"}</span>
                <span className="text-[9px] text-white/20 ml-auto">Powered by Gemini</span>
              </div>
              {aiLoading ? <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-2 rounded-full bg-white/5 animate-pulse" style={{ width: `${30 + i * 20}%`, animationDelay: `${i * 0.15}s` }} />)}</div> : <p className="text-sm text-white/60 leading-relaxed">{aiInterpretation}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {cascadeTree && cascadeTree.tree.size > 1 && (() => {
        const { root, tree } = cascadeTree;
        const rootNode = graphNodes.find((n) => n.id === root);
        const renderBranch = (nodeId: string, depth: number): React.ReactNode => {
          const node = graphNodes.find((n) => n.id === nodeId);
          if (!node) return null;
          const children = tree.get(nodeId) || [];
          const color = LEVEL_COLORS[node.trophic_level] || "#64748b";
          const isRoot = depth === 0;
          return (
            <div key={nodeId} className={depth > 0 ? "ml-6 border-l border-white/[0.06] pl-4" : ""}>
              <div className="flex items-center gap-2 py-1.5">
                {depth > 0 && <svg width="12" height="12" className="shrink-0 -ml-[21px] mr-1"><path d="M 0 0 L 6 6 L 12 0" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="1.5" /></svg>}
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isRoot ? "#ef4444" : color, opacity: isRoot ? 1 : 0.7 }} />
                <span className={`text-xs font-medium ${isRoot ? "text-red-400" : "text-white/60"}`}>
                  {node.common_name || node.id}
                </span>
                <span className="text-[9px] text-white/20 capitalize">{node.trophic_level.replace(/_/g, " ")}</span>
                {isRoot && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400/70 font-mono">REMOVED</span>}
                {children.length > 0 && <span className="text-[9px] text-red-400/40 font-mono">→ {children.length}</span>}
              </div>
              {children.map((cid) => renderBranch(cid, depth + 1))}
            </div>
          );
        };
        return (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4, delay: 0.2 }} className="mt-4 rounded-xl border border-red-500/10 overflow-hidden" style={{ background: "rgba(14,6,6,0.5)" }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-[10px] uppercase tracking-wider text-red-400/70 font-medium">Cascade Flowchart</span>
                <span className="text-[9px] text-white/20 ml-auto">{tree.size - 1} species collapsed</span>
              </div>
              <div className="max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                {renderBranch(root, 0)}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {removalLog.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <button
            onClick={() => setShowReport(!showReport)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] hover:border-emerald-500/15 transition"
            style={{ background: "rgba(6,14,8,0.4)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-white/60">Cascade Removal Report</span>
              <span className="text-[9px] text-white/25 font-mono">{removalLog.length} simulation{removalLog.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono ${((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 50 ? "text-red-400" : "text-white/40"}`}>
                {(((graphNodes.length - removedNodes.size) / graphNodes.length) * 100).toFixed(0)}% health
              </span>
              <svg className={`w-3 h-3 text-white/30 transition ${showReport ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>
          <AnimatePresence>
            {showReport && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="mt-2 rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(6,10,7,0.6)" }}>
                  <div className="p-4 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-white/70">Cumulative Impact Report</h4>
                      <button onClick={downloadReport} className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/70 hover:text-emerald-400 font-medium transition">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        Download Full Report
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white/[0.03] rounded-lg p-2.5"><div className="text-[9px] text-white/25 uppercase font-mono">Directly Removed</div><div className="text-lg font-bold text-red-400">{removalLog.length}</div></div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5"><div className="text-[9px] text-white/25 uppercase font-mono">Cascade Victims</div><div className="text-lg font-bold text-orange-400">{removalLog.reduce((s, e) => s + e.cascadeVictimCount, 0)}</div></div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5"><div className="text-[9px] text-white/25 uppercase font-mono">Total Lost</div><div className="text-lg font-bold text-white/70">{removedNodes.size}</div></div>
                      <div className="bg-white/[0.03] rounded-lg p-2.5"><div className="text-[9px] text-white/25 uppercase font-mono">Surviving</div><div className={`text-lg font-bold ${((graphNodes.length - removedNodes.size) / graphNodes.length) * 100 < 50 ? "text-red-400" : "text-emerald-400"}`}>{graphNodes.length - removedNodes.size} <span className="text-[10px] font-normal text-white/20">/ {graphNodes.length}</span></div></div>
                    </div>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {removalLog.map((entry, i) => (
                      <div key={`report-${i}`} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/15 font-mono w-5">{i + 1}.</span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[entry.trophicLevel] || "#64748b" }} />
                            <div>
                              <span className="text-sm font-medium text-white/80">{entry.speciesName}</span>
                              <span className="text-[9px] text-white/20 ml-2 capitalize">{entry.trophicLevel.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-mono font-bold ${entry.impactPct > 10 ? "text-red-400" : entry.impactPct > 5 ? "text-orange-400" : "text-white/50"}`}>{entry.impactPct.toFixed(1)}%</span>
                            <div className="text-[9px] text-white/15 font-mono">impact</div>
                          </div>
                        </div>
                        <div className="ml-8 space-y-1.5">
                          <div className="flex items-center gap-4 text-[10px]">
                            <span className="text-white/30">{entry.observations.toLocaleString()} observations</span>
                            <span className="text-white/30">keystone: {(entry.keystoneScore * 100).toFixed(1)}%</span>
                            <span className="text-red-400/50">{entry.cascadeVictimCount} cascaded</span>
                          </div>
                          {entry.cascadeVictimNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {entry.cascadeVictimNames.slice(0, 8).map((name) => (
                                <span key={name} className="px-1.5 py-0.5 text-[9px] text-white/35 border border-white/[0.06] rounded font-mono italic">{name}</span>
                              ))}
                              {entry.cascadeVictimNames.length > 8 && <span className="px-1.5 py-0.5 text-[9px] text-white/20 font-mono">+{entry.cascadeVictimNames.length - 8} more</span>}
                            </div>
                          )}
                          {entry.aiAssessment && (
                            <div className="mt-2 text-[11px] text-white/40 leading-relaxed border-l-2 border-emerald-500/15 pl-3">{entry.aiAssessment}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-white/30">
        <span>Drag to pan · Click to inspect · <span className="text-red-400/50">◎ = keystone</span></span>
        <span>{simNodes.length} species · {simLinks.length} connections{selectedEcosystem && ` in ${selectedEcosystem}`}{zone && ` in ${zone.name}`}</span>
      </div>
    </motion.div>
  );
}
