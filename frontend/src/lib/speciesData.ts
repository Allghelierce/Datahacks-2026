// Auto-generated types and metadata from data
// Source data is fetched from /data/app-data.json to keep bundle size small.

import ecosystemData from "./ecosystemIndex.json";

export const APP_DATA_URL = "/data/app-data.json";

export interface ZoneNode {
  id: string;
  common_name: string;
  trophic_level: string;
  observations: number;
  decline_trend: number;
  keystone_score: number;
  zone_keystone_score: number;
}

export interface DependencyNode {
  id: string;
  common_name: string;
  trophic_level: string;
  trophic_label: string;
  iconic_taxon: string;
  order: string;
  family: string;
  observations: number;
  zone_count: number;
  decline_trend: number;
  keystone_score: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
}

export interface KeystoneRanking {
  id: string;
  common_name: string;
  trophic_level: string;
  keystone_score: number;
  decline_trend: number;
  cascade_victims: string[];
  cascade_victim_names: string[];
  trophic_levels_affected: number;
  zones_present: number;
  observations: number;
  priority: string;
}

export interface ZoneKeystoneEntry {
  id: string;
  common_name: string;
  trophic_level: string;
  zone_keystone_score: number;
  decline_trend: number;
  cascade_victim_count: number;
  cascade_victim_names: string[];
  trophic_levels_affected: number;
  priority: "critical" | "high" | "medium" | "low";
}

export interface EcosystemIndex {
  description: string;
  keywords: string[];
  zone_count: number;
  species_count: number;
  edge_count: number;
  keystones: { common_name: string; zone_keystone_score: number }[];
  zones: { id: string; name: string; grade: string; score: number }[];
}

export interface GlobalStats {
  totalSpecies: number;
  totalObservations: number;
  totalZones: number;
  zonesAtRisk: number;
  trophicBreakdown: Record<string, number>;
  healthDistribution: Record<string, number>;
  ecosystemCount: number;
}

export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total_species: number;
  total_observations: number;
  health: {
    grade: string;
    score: number;
    risks: { type: string; message: string }[];
    trophic_completeness: number;
    trend_pct: number;
  };
  trophic: Record<string, { count: number; species: string[] }>;
  yearly_species: Record<string, number>;
  top_families: Record<string, number>;
}

export interface EcosystemGraph {
  description: string;
  keywords: string[];
  zone_count: number;
  species_count: number;
  edge_count: number;
  keystones: ZoneKeystoneEntry[];
  zones: { id: string; name: string; grade: string; score: number }[];
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface CollapsePrediction {
  zone: string;
  zone_id: string;
  grade: string;
  score: number;
  missing_levels: string[];
  at_risk_species: string[];
  risks: any[];
}

export const ECOSYSTEM_INDEX: Record<string, EcosystemIndex> = ecosystemData.ecosystem_index as Record<string, EcosystemIndex>;
export const GLOBAL_STATS: GlobalStats = ecosystemData.global_stats as GlobalStats;
