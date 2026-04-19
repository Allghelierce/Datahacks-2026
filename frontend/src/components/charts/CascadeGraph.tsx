"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DEPENDENCY_NODES,
  DEPENDENCY_EDGES,
  ZONE_DEPENDENCY_GRAPHS,
  type DependencyNode,
  type DependencyEdge,
  type ZoneNode,
  type Zone,
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

const LEVEL_COLORS: Record<string, string> = {
  producer: "#34d399",
  pollinator: "#f472b6",
  primary_consumer: "#fbbf24",
  secondary_consumer: "#22d3ee",
  tertiary_consumer: "#818cf8",
  apex_predator: "#ef4444",
  decomposer: "#a78bfa",
};

const EDGE_COLORS: Record<string, string> = {
  "food source": "#34d399",
  pollination: "#f472b6",
  prey: "#f97316",
};

const LEVEL_Y: Record<string, number> = {
  producer: 0.85,
  decomposer: 0.85,
  pollinator: 0.65,
  primary_consumer: 0.65,
  secondary_consumer: 0.45,
  tertiary_consumer: 0.25,
  apex_predator: 0.08,
};

interface NodePos {
  x: number;
  y: number;
  node: GraphNode;
}

interface Props {
  zone?: Zone | null;
}

export default function CascadeGraph({ zone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [removedNodes, setRemovedNodes] = useState<Set<string>>(new Set());
  const [cascadeAnimating, setCascadeAnimating] = useState(false);
  const [animatedVictims, setAnimatedVictims] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDims({ w: width, h: Math.max(500, width * 0.6) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setRemovedNodes(new Set());
    setSelectedNode(null);
    setHoveredNode(null);
    setAnimatedVictims(new Set());
  }, [zone]);

  const { nodes, edges } = useMemo((): {
    nodes: GraphNode[];
    edges: readonly DependencyEdge[] | DependencyEdge[];
  } => {
    if (zone) {
      const zoneGraph = ZONE_DEPENDENCY_GRAPHS[zone.id];
      if (zoneGraph) {
        return { nodes: zoneGraph.nodes, edges: zoneGraph.edges };
      }
    }
    return {
      nodes: DEPENDENCY_NODES as unknown as GraphNode[],
      edges: DEPENDENCY_EDGES,
    };
  }, [zone]);

  const activeNodes = nodes.filter((n) => !removedNodes.has(n.id));

  const getCascadeVictims = useCallback(
    (removedId: string): Set<string> => {
      const victims = new Set<string>();
      const queue = [removedId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const edge of edges) {
          if (
            edge.source === current &&
            !victims.has(edge.target) &&
            !removedNodes.has(edge.target)
          ) {
            const sourceNodes = (edges as DependencyEdge[])
              .filter((e) => e.target === edge.target && e.source !== current)
              .map((e) => e.source)
              .filter(
                (s) =>
                  !removedNodes.has(s) && s !== removedId && !victims.has(s)
              );
            if (sourceNodes.length === 0) {
              victims.add(edge.target);
              queue.push(edge.target);
            }
          }
        }
      }
      return victims;
    },
    [removedNodes, edges]
  );

  const cascadeVictims = hoveredNode
    ? getCascadeVictims(hoveredNode)
    : new Set<string>();

  const cascadeImpactPct = hoveredNode
    ? ((cascadeVictims.size + 1) / nodes.length) * 100
    : 0;

  const getTrophicDepth = useCallback(
    (nodeId: string): number => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return 0;
      const order = [
        "producer",
        "decomposer",
        "pollinator",
        "primary_consumer",
        "secondary_consumer",
        "tertiary_consumer",
        "apex_predator",
      ];
      return order.indexOf(node.trophic_level);
    },
    [nodes]
  );

  const animateCascade = useCallback(
    (removedId: string) => {
      const victims = getCascadeVictims(removedId);
      if (victims.size === 0) {
        setRemovedNodes((prev) => {
          const next = new Set(prev);
          next.add(removedId);
          return next;
        });
        return;
      }

      setCascadeAnimating(true);
      setAnimatedVictims(new Set());

      const sorted = Array.from(victims).sort(
        (a, b) => getTrophicDepth(a) - getTrophicDepth(b)
      );

      const levels = new Map<number, string[]>();
      sorted.forEach((v) => {
        const depth = getTrophicDepth(v);
        if (!levels.has(depth)) levels.set(depth, []);
        levels.get(depth)!.push(v);
      });

      let delay = 0;
      const accumulated = new Set<string>([removedId]);
      const sortedEntries = Array.from(levels.entries()).sort(
        ([a], [b]) => a - b
      );
      for (const [, levelNodes] of sortedEntries) {
        const currentDelay = delay;
        setTimeout(() => {
          setAnimatedVictims((prev) => {
            const next = new Set(prev);
            for (const v of levelNodes) next.add(v);
            return next;
          });
        }, currentDelay);
        for (const v of levelNodes) accumulated.add(v);
        delay += 400;
      }

      setTimeout(() => {
        setRemovedNodes((prev) => {
          const next = new Set(prev);
          accumulated.forEach((v) => next.add(v));
          return next;
        });
        setAnimatedVictims(new Set());
        setCascadeAnimating(false);
      }, delay + 300);
    },
    [getCascadeVictims, getTrophicDepth]
  );

  const nodePositions: NodePos[] = useMemo(() => {
    const byLevel: Record<string, GraphNode[]> = {};
    for (const n of activeNodes) {
      if (!byLevel[n.trophic_level]) byLevel[n.trophic_level] = [];
      byLevel[n.trophic_level].push(n);
    }

    const positions: NodePos[] = [];
    for (const [level, lvlNodes] of Object.entries(byLevel)) {
      const yBase = (LEVEL_Y[level] ?? 0.5) * dims.h;
      const spacing = dims.w / (lvlNodes.length + 1);
      lvlNodes.forEach((node, i) => {
        positions.push({
          x: spacing * (i + 1),
          y: yBase + Math.sin(i * 1.5) * 15,
          node,
        });
      });
    }
    return positions;
  }, [activeNodes, dims]);

  const getNodePos = (id: string) =>
    nodePositions.find((np) => np.node.id === id);

  const handleNodeClick = (id: string) => {
    if (cascadeAnimating) return;
    setSelectedNode(selectedNode === id ? null : id);
  };

  const handleSimulateRemoval = (id: string) => {
    if (cascadeAnimating) return;
    setSelectedNode(null);
    animateCascade(id);
  };

  const selectedNodeData = selectedNode
    ? nodes.find((n) => n.id === selectedNode) ?? null
    : null;
  const selectedIsRemoved = selectedNode
    ? removedNodes.has(selectedNode)
    : false;

  const selectedKeystoneImpact = selectedNode
    ? ((getCascadeVictims(selectedNode).size + 1) / nodes.length) * 100
    : 0;

  const bezierPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): string => {
    const midY = (y1 + y2) / 2;
    const cpOffset = Math.abs(y2 - y1) * 0.4;
    return `M ${x1} ${y1} C ${x1} ${midY - cpOffset}, ${x2} ${midY + cpOffset}, ${x2} ${y2}`;
  };

  const totalRemoved = removedNodes.size;
  const isZoneView = !!zone;
  const keystoneLabel = isZoneView ? "Zone Keystone" : "Keystone Score";

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            Ecosystem Dependency Cascade
            {zone && (
              <span className="text-sm font-normal text-white/40 ml-2">
                — {zone.name}
              </span>
            )}
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Click a species to inspect — simulate removal to watch the cascade
            ripple through the food web
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hoveredNode && cascadeVictims.size > 0 && (
            <span className="text-sm text-orange-400 font-medium animate-pulse">
              cascade impact: {cascadeImpactPct.toFixed(1)}% of ecosystem
            </span>
          )}
          {totalRemoved > 0 && (
            <>
              <span className="text-sm text-red-400 font-medium">
                {totalRemoved} species collapsed
              </span>
              <button
                onClick={() => {
                  setRemovedNodes(new Set());
                  setSelectedNode(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-4">
          {Object.entries(LEVEL_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-white/30 capitalize">
                {level.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-3">
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-white/30 capitalize">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl bg-black/20 overflow-hidden border border-white/5">
        <svg ref={svgRef} width={dims.w} height={dims.h} className="w-full">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="cascade-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Level band labels */}
          {Object.entries(LEVEL_Y).map(([level, yPct]) => (
            <text
              key={level}
              x={12}
              y={yPct * dims.h - 12}
              fill="rgba(255,255,255,0.08)"
              fontSize={9}
              textAnchor="start"
              className="uppercase"
            >
              {level.replace("_", " ")}
            </text>
          ))}

          {/* Edges — curved bezier paths */}
          {(edges as DependencyEdge[]).map((edge, i) => {
            const source = getNodePos(edge.source);
            const target = getNodePos(edge.target);
            if (!source || !target) return null;

            const isHighlighted =
              hoveredNode === edge.source || hoveredNode === edge.target;
            const isCascade =
              hoveredNode === edge.source && cascadeVictims.has(edge.target);
            const isAnimatingCascade =
              animatedVictims.has(edge.source) &&
              animatedVictims.has(edge.target);

            const edgeColor =
              EDGE_COLORS[edge.type] || "rgba(255,255,255,0.1)";
            const d = bezierPath(source.x, source.y, target.x, target.y);

            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={
                    isCascade || isAnimatingCascade
                      ? "#ef4444"
                      : isHighlighted
                      ? edgeColor
                      : "rgba(255,255,255,0.04)"
                  }
                  strokeWidth={
                    isCascade || isAnimatingCascade
                      ? 2.5
                      : isHighlighted
                      ? 1.5
                      : 0.5
                  }
                  strokeDasharray={isCascade ? "6 3" : "none"}
                  opacity={
                    isCascade || isAnimatingCascade
                      ? 1
                      : isHighlighted
                      ? 0.7
                      : 0.5
                  }
                  style={{
                    transition: "stroke 0.3s, stroke-width 0.3s, opacity 0.3s",
                  }}
                />
                {isCascade && (
                  <circle r="3" fill="#ef4444" filter="url(#cascade-glow)">
                    <animateMotion
                      dur="1s"
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodePositions.map((np) => {
            const color = LEVEL_COLORS[np.node.trophic_level] || "#64748b";
            const isHovered = hoveredNode === np.node.id;
            const isSelected = selectedNode === np.node.id;
            const isCascadeVictim = cascadeVictims.has(np.node.id);
            const isAnimatingVictim = animatedVictims.has(np.node.id);
            const isDeclining = np.node.decline_trend < -30;
            const radius = Math.max(
              5,
              Math.min(14, Math.sqrt(np.node.observations) * 0.8)
            );

            return (
              <g
                key={np.node.id}
                onMouseEnter={() => setHoveredNode(np.node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(np.node.id)}
                className="cursor-pointer"
              >
                {/* Decline indicator ring */}
                {isDeclining && !isCascadeVictim && !isAnimatingVictim && (
                  <circle
                    cx={np.x}
                    cy={np.y}
                    r={radius + 5}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    opacity={0.4}
                  />
                )}

                {/* Glow ring */}
                {(isHovered || isCascadeVictim || isSelected) && (
                  <circle
                    cx={np.x}
                    cy={np.y}
                    r={radius + 8}
                    fill="none"
                    stroke={
                      isCascadeVictim
                        ? "#ef4444"
                        : isSelected
                        ? "#fff"
                        : color
                    }
                    strokeWidth={isSelected ? 1.5 : 1}
                    opacity={0.4}
                    filter="url(#glow)"
                  />
                )}

                {/* Cascade animation ring */}
                {isAnimatingVictim && (
                  <circle
                    cx={np.x}
                    cy={np.y}
                    r={radius + 4}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2}
                    opacity={0}
                  >
                    <animate
                      attributeName="r"
                      from={String(radius)}
                      to={String(radius + 20)}
                      dur="0.6s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur="0.6s"
                      fill="freeze"
                    />
                  </circle>
                )}

                {/* Main circle */}
                <circle
                  cx={np.x}
                  cy={np.y}
                  r={isHovered || isSelected ? radius + 3 : radius}
                  fill={
                    isCascadeVictim || isAnimatingVictim
                      ? "#ef444480"
                      : color
                  }
                  stroke={
                    isSelected
                      ? "#fff"
                      : isHovered
                      ? "#fff"
                      : "rgba(0,0,0,0.3)"
                  }
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                  opacity={isCascadeVictim ? 0.5 : 0.8}
                  style={{ transition: "all 0.2s ease" }}
                />

                {/* Label on hover */}
                {(isHovered || isSelected) && (
                  <>
                    <rect
                      x={np.x - 80}
                      y={np.y - radius - 32}
                      width={160}
                      height={22}
                      rx={6}
                      fill="rgba(0,0,0,0.85)"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={np.x}
                      y={np.y - radius - 17}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={10}
                      fontWeight="600"
                    >
                      {np.node.common_name || np.node.id}
                    </text>
                  </>
                )}

                {/* Cascade victim marker */}
                {(isCascadeVictim || isAnimatingVictim) && (
                  <text
                    x={np.x}
                    y={np.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={radius}
                    fontWeight="bold"
                  >
                    ×
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Info panel on click */}
        <AnimatePresence>
          {selectedNodeData && !selectedIsRemoved && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-4 right-4 w-72 bg-black/90 border border-white/10 rounded-xl p-4 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {selectedNodeData.common_name || selectedNodeData.id}
                  </h4>
                  <p className="text-xs text-white/40 italic">
                    {selectedNodeData.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-white/30 hover:text-white/60 text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[10px] text-white/30 uppercase">
                    Observations
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {selectedNodeData.observations.toLocaleString()}
                  </div>
                </div>
                {selectedNodeData.zone_count != null && (
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-white/30 uppercase">
                      Zones
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {selectedNodeData.zone_count}
                    </div>
                  </div>
                )}
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[10px] text-white/30 uppercase">
                    Trophic Level
                  </div>
                  <div
                    className="text-sm font-semibold capitalize"
                    style={{
                      color: LEVEL_COLORS[selectedNodeData.trophic_level],
                    }}
                  >
                    {selectedNodeData.trophic_level.replace("_", " ")}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[10px] text-white/30 uppercase">
                    {keystoneLabel}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      (isZoneView
                        ? selectedNodeData.zone_keystone_score ?? 0
                        : selectedNodeData.keystone_score) > 0.02
                        ? "text-orange-400"
                        : "text-white/60"
                    }`}
                  >
                    {(
                      (isZoneView
                        ? selectedNodeData.zone_keystone_score ?? 0
                        : selectedNodeData.keystone_score) * 100
                    ).toFixed(1)}
                    %
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[10px] text-white/30 uppercase">
                    YoY Trend
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      selectedNodeData.decline_trend < -30
                        ? "text-red-400"
                        : selectedNodeData.decline_trend < 0
                        ? "text-orange-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {selectedNodeData.decline_trend > 0 ? "+" : ""}
                    {selectedNodeData.decline_trend.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-[10px] text-white/30 uppercase">
                    Cascade Impact
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      selectedKeystoneImpact > 30
                        ? "text-red-400"
                        : selectedKeystoneImpact > 15
                        ? "text-orange-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {selectedKeystoneImpact.toFixed(1)}%
                  </div>
                </div>
              </div>

              {selectedNodeData.family && (
                <div className="text-xs text-white/40 mb-3">
                  <span className="text-white/20">Family:</span>{" "}
                  {selectedNodeData.family} •{" "}
                  <span className="text-white/20">Order:</span>{" "}
                  {selectedNodeData.order}
                </div>
              )}

              {selectedNodeData.decline_trend < -30 &&
                selectedNodeData.keystone_score > 0 && (
                  <div className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300 mb-3">
                    Critical priority — high keystone score AND declining
                  </div>
                )}

              <button
                onClick={() => handleSimulateRemoval(selectedNode!)}
                disabled={cascadeAnimating}
                className="w-full text-xs px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simulate Removal
                {getCascadeVictims(selectedNode!).size > 0 && (
                  <span className="ml-1 text-red-400/60">
                    — cascades to {getCascadeVictims(selectedNode!).size}{" "}
                    species
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-white/30">
        <span>
          Hover to preview cascade • Click to inspect • Size = observation count
          {" • "}
          <span className="text-orange-400/50">◌ dashed = declining</span>
        </span>
        <span>
          {activeNodes.length}/{nodes.length} species remaining
          {zone && ` in ${zone.name}`}
        </span>
      </div>
    </motion.div>
  );
}
