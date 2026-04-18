export interface Region {
  region: string;
  biodiversity_score: number;
  unique_species: number;
  total_observations: number;
  rank: number;
}

export interface TrendPoint {
  year_month: string;
  unique_species: number;
  observation_count: number;
  region?: string;
}

export interface MonthlyTrend {
  year_month: string;
  total_unique_species: number;
  total_observations: number;
  regions_reporting: number;
}

export interface DecliningRegion {
  region: string;
  first_year_species: number;
  last_year_species: number;
  species_change: number;
  pct_change: number;
}

export interface RegionDetail {
  region: Region;
  trends: TrendPoint[];
  decline_info: DecliningRegion | null;
}

export interface ExplainResponse {
  region: string;
  explanation: string;
}
