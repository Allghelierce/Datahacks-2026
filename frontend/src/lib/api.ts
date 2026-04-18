import type { Region, RegionDetail, MonthlyTrend, DecliningRegion, ExplainResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://your-api-gateway-url.amazonaws.com/prod";

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getRegions(): Promise<Region[]> {
  const data = await fetchJSON<{ regions: Region[] }>("/regions");
  return data.regions;
}

export async function getRegionDetail(regionId: string): Promise<RegionDetail> {
  return fetchJSON<RegionDetail>(`/regions/${regionId}`);
}

export async function getTrends(): Promise<{ monthly_trends: MonthlyTrend[]; declining_regions: DecliningRegion[] }> {
  return fetchJSON("/trends");
}

export async function explainRegion(region: string, data: Record<string, unknown>): Promise<ExplainResponse> {
  return fetchJSON<ExplainResponse>("/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region, data }),
  });
}
