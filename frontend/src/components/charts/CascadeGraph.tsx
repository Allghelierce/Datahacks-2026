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
  "Coastal Marine & Estuary": "\ud83c\udf0a",
  "Coastal Sage Scrub": "\ud83c\udf3f",
  "Chaparral & Grassland": "\ud83c\udf3e",
  "Mountain Forest": "\ud83c\udf32",
  "Desert & Arid Scrub": "\ud83c\udfdc\ufe0f",
  "Inland Valley & Riparian": "\ud83d\udca7",
  "Border & Transition": "\ud83d\uddfa\ufe0f",
  "Urban Parkland": "\ud83c\udfd9\ufe0f",
};

const TROPHIC_LAYERS: Record<string, number> = {
  decomposer: 0.9,
  producer: 0.8,
  pollinator: 0.6,
  primary_consumer: 0.5,
  secondary_consumer: 0.35,
  tertiary_consumer: 0.2,
  apex_predator: 0.1,
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
      setDims({ w: width, h: Math.max(850, Math.min(window.innerHeight * 0.85, width * 1.0)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
        if (text) { setAiInterpretation(text); setAiLoading(false); return; }
      } catch { /* fallback */ }
    }
    const roleMap: Record<string, string> = { producer: "primary production", pollinator: "pollination services", primary_consumer: "herbivore energy transfer", secondary_consumer: "mid-level predation", tertiary_consumer: "upper food chain regulation", apex_predator: "top-down population control", decomposer: "nutrient recycling" };
    const lostFunctions = trophicLevelsHit.map((l) => roleMap[l] || l.replace(/_/g, " ")).join(", ");
    setAiInterpretation(`Removing ${removed.common_name || removed.id} from ${ecoName}'s ecosystem triggers a cascade collapse affecting ${totalCollapsed - 1} species across ${trophicLevelsHit.length} trophic level${trophicLevelsHit.length > 1 ? "s" : ""}, representing ${impactPct}% of the local food web. The loss eliminates critical ecological functions including ${lostFunctions}. Priority action: establish protected habitat corridors for ${removed.common_name || removed.id} populations in ${ecoName}.`);
    setAiLoading(false);
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
        radius: Math.max(4, Math.min(16, Math.sqrt(n.observations) * 0.6)), 
        x: prev?.x ?? dims.w / 2 + (Math.random() - 0.5) * dims.w * 0.5, 
        y: prev?.y ?? dims.h / 2 + (Math.random() - 0.5) * dims.h * 0.5, 
        vx: 0, 
        vy: 0 
      };
    });
    const nodeMap = new Map(sNodes.map((n) => [n.data.id, n]));
    const sLinks: SimLink[] = graphEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).map((e) => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, edgeType: e.type })).filter((l) => l.source && l.target);
    
    const sim = forceSimulation<SimNode>(sNodes)
      .force("link", forceLink<SimNode, SimLink>(sLinks).id((d) => d.data.id).distance(100).strength(0.15))
      .force("charge", forceManyBody<SimNode>().strength(-220).distanceMax(450))
      .force("center", forceCenter(dims.w / 2, dims.h / 2).strength(0.02))
      .force("collide", forceCollide<SimNode>().radius((d) => d.radius + 20).strength(0.7).iterations(1))
      .force("x", forceX<SimNode>(dims.w / 2).strength(0.04))
      .force("y", forceY<SimNode>((d) => dims.h * (TROPHIC_LAYERS[d.data.trophic_level] ?? 0.5)).strength(0.12))
      .alphaDecay(0.06).velocityDecay(0.5);

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
      if (sim.alpha() > 0.001) animFrameRef.current = requestAnimationFrame(tick);
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
    select(svgRef.current).selectAll<SVGGElement, SimNode>(".node-group")
      .data(simNodes, (d: any) => d?.data?.id)
      .call(dragRef.current as any);
  }, [simNodes]);

  const handleZoomSlider = useCallback((s: number) => {
    const svg = svgRef.current; if (!svg) return;
    const t = transformRef.current; const cx = dims.w / 2; const cy = dims.h / 2; const r = s / t.k;
    const newT = zoomIdentity.translate(cx - (cx - t.x) * r, cy - (cy - t.y) * r).scale(s);
    select(svg).call(zoomBehavior.transform as any, newT);
  }, [dims, zoomBehavior]);

  useEffect(() => {
    prevPositions.current.clear(); setRemovedNodes(new Set()); setSelectedNode(null); setHoveredNode(null); setSearchQuery(""); setAnimatedVictims(new Set()); setActiveTrophicFilters(new Set(Object.keys(LEVEL_COLORS))); setAiInterpretation(null);
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
    <motion.div ref={containerRef} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="glass rounded-2xl p-6">
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
          {totalRemoved > 0 && (<><span className="text-sm text-red-400 font-medium">{totalRemoved} removed</span><button onClick={() => { setRemovedNodes(new Set()); setSelectedNode(null); setAiInterpretation(null); setCascadeTree(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition">Reset</button></>)}
        </div>
      </div>

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
              {filteredEcosystems.map(([name, eco]) => {
                const icon = ECO_ICONS[name] || "\ud83c\udf3f";
                const avgScore = eco.zones.length > 0 ? eco.zones.reduce((sum: number, z: { score: number }) => sum + z.score, 0) / eco.zones.length : 0;
                const healthColor = avgScore >= 65 ? "text-emerald-400" : avgScore >= 50 ? "text-amber-400" : "text-red-400";
                return (
                  <button key={name} onClick={() => { setSelectedEcosystem(name); setShowEcoBrowser(false); }}
                    className="text-left p-4 rounded-xl border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 group"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(16,70,32,0.02))" }}>
                    <div className="flex items-center gap-2 mb-2"><span className="text-xl">{icon}</span><h4 className="text-sm font-medium text-white/80 group-hover:text-white transition line-clamp-1">{name}</h4></div>
                    <p className="text-[11px] text-white/30 mb-3 line-clamp-2">{eco.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/25">{eco.species_count} species · {eco.edge_count} links</span>
                      <span className={`text-[10px] font-medium ${healthColor}`}>{avgScore.toFixed(0)}%</span>
                    </div>
                    {eco.keystones.length > 0 && <div className="mt-2 flex items-center gap-1"><span className="text-[9px] text-orange-400/60">keystone:</span><span className="text-[9px] text-white/40 truncate">{eco.keystones[0].common_name}</span></div>}
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

      {(!showEcoBrowser || zone) && (
        <div className="flex items-center justify-center gap-4 mb-3">
          {Object.entries(EDGE_COLORS_BRIGHT).map(([type, color]) => (<div key={type} className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} /><span className="text-[10px] text-white/30 capitalize">{type}</span></div>))}
        </div>
      )}

      {(!showEcoBrowser || zone) && (
        <div className="relative rounded-xl overflow-hidden border border-white/[0.04]" style={{ background: "#060a07" }}>
          <div className="absolute inset-0 pointer-events-none z-[1]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
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
                const isAnimVictim = animatedVictims.has(node.data.id); const isDeclining = node.data.decline_trend < -30;
                const dimmed = activeId && !isHovered && !isSelected && !isConnected && !isCascadeVictim;
                const isKeystone = (node.data.zone_keystone_score ?? node.data.keystone_score ?? 0) > 0.02;
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
                return (
                  <g 
                    key={node.data.id} 
                    className="node-group cursor-pointer" 
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
                    style={{ opacity: dimmed ? 0.25 : 1 }}
                  >
                    {!dimmed && <circle cx={node.x} cy={node.y} r={r + 12} fill={color} opacity={isHovered || isSelected ? 0.18 : 0.06}  />}
                    {isDeclining && !dimmed && !isCascadeVictim && <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke="#f97316" strokeWidth={0.8} strokeDasharray="2 2" opacity={0.4}><animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" /></circle>}
                    {isAnimVictim && <circle cx={node.x} cy={node.y} r={r} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0}><animate attributeName="r" from={String(r)} to={String(r + 30)} dur="0.7s" fill="freeze" /><animate attributeName="opacity" from="0.8" to="0" dur="0.7s" fill="freeze" /></circle>}
                    {isKeystone && !dimmed && !isCascadeVictim && <circle cx={node.x} cy={node.y} r={r + 7} fill="none" stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" opacity={0.5}><animate attributeName="opacity" values="0.3;0.6;0.3" dur="4s" repeatCount="indefinite" /></circle>}
                    <circle cx={node.x} cy={node.y} r={r} fill={isCascadeVictim || isAnimVictim ? "rgba(239,68,68,0.3)" : "#0a0f0b"} stroke={isSelected ? "#fff" : isHovered ? "rgba(255,255,255,0.7)" : isCascadeVictim ? "#ef4444" : isKeystone ? "#fbbf24" : color} strokeWidth={isSelected ? 2.5 : isHovered ? 2 : isKeystone ? 2 : 1.5} opacity={isCascadeVictim ? 0.4 : 1} />
                    {(() => {
                      const photoUrl = speciesPhotos[node.data.id];
                      const clipId = `clip-${node.data.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
                      if (photoUrl) {
                        return (
                          <image
                            href={photoUrl}
                            x={node.x - r + 1.5}
                            y={node.y - r + 1.5}
                            width={(r - 1.5) * 2}
                            height={(r - 1.5) * 2}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                            opacity={isCascadeVictim || isAnimVictim ? 0.2 : 1}
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      }
                      return <circle cx={node.x} cy={node.y} r={r - 2} fill={`${color}30`} style={{ pointerEvents: "none" }} />;
                    })()}
                    {(isCascadeVictim || isAnimVictim) && <text x={node.x} y={(node.y ?? 0) + r * 0.35} textAnchor="middle" fill="#ef4444" fontSize={r * 1.4} fontWeight="bold" style={{ pointerEvents: "none" }}>{"\u00d7"}</text>}
                    {isKeystone && !dimmed && !isCascadeVictim && <text x={node.x} y={(node.y ?? 0) - r - 6} textAnchor="middle" fill="#fbbf24" fontSize={9} opacity={0.6} style={{ pointerEvents: "none" }}>★</text>}
                    {(isHovered || isSelected) && <text x={node.x} y={(node.y ?? 0) + r + 12} textAnchor="middle" fill={isCascadeVictim ? "rgba(239,68,68,0.6)" : isKeystone ? "#fbbf24" : "#fff"} fontSize={10} fontWeight="600" letterSpacing="0.01em" paintOrder="stroke" stroke="rgba(6,10,7,0.9)" strokeWidth={4} style={{ textDecoration: isCascadeVictim ? "line-through" : "none" }}>{node.data.common_name || node.data.id}</text>}
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
                  <div className="bg-white/5 rounded-lg p-2"><div className="text-[10px] text-white/30 uppercase">Keystone</div><div className={`text-sm font-semibold ${((selectedData.zone_keystone_score ?? selectedData.keystone_score) ?? 0) > 0.02 ? "text-orange-400" : "text-white/60"}`}>{(((selectedData.zone_keystone_score ?? selectedData.keystone_score) ?? 0) * 100).toFixed(1)}%</div></div>
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
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 border border-white/[0.06]" style={{ background: "rgba(8,8,8,0.9)" }}>
            <button onClick={() => handleZoomSlider(Math.max(0.2, transform.k - 0.3))} className="text-white/30 hover:text-white/60 text-xs font-mono w-5 h-5 flex items-center justify-center transition">−</button>
            <input type="range" min={0.2} max={5} step={0.05} value={transform.k} onChange={(e) => handleZoomSlider(parseFloat(e.target.value))} className="w-20 h-px appearance-none bg-white/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white/40 [&::-webkit-slider-thumb]:cursor-pointer" />
            <button onClick={() => handleZoomSlider(Math.min(5, transform.k + 0.3))} className="text-white/30 hover:text-white/60 text-xs font-mono w-5 h-5 flex items-center justify-center transition">+</button>
            <span className="text-[9px] text-white/20 ml-1 w-8 text-right tabular-nums font-mono">{(transform.k * 100).toFixed(0)}%</span>
          </div>
        </div>
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

      <div className="mt-4 flex items-center justify-between text-xs text-white/30">
        <span>Drag to pan · Click to inspect · <span className="text-orange-400/50">◌ = declining</span> · <span className="text-amber-400/50">★ = keystone</span></span>
        <span>{simNodes.length} species · {simLinks.length} connections{selectedEcosystem && ` in ${selectedEcosystem}`}{zone && ` in ${zone.name}`}</span>
      </div>
    </motion.div>
  );
}
