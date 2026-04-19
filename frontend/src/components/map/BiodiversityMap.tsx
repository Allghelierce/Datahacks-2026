"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { Region } from "@/types";
import "leaflet/dist/leaflet.css";

const REGION_COORDS: Record<string, [number, number]> = {
  California: [36.78, -119.42],
  Oregon: [43.8, -120.55],
  Washington: [47.75, -120.74],
  Nevada: [38.8, -116.42],
  Arizona: [34.05, -111.09],
  Colorado: [39.55, -105.78],
  Utah: [39.32, -111.09],
  "New Mexico": [34.52, -105.87],
  Texas: [31.97, -99.9],
  Florida: [27.66, -81.52],
};

function getColor(score: number): string {
  if (score >= 4) return "#34d399";
  if (score >= 3) return "#a3e635";
  if (score >= 2) return "#fbbf24";
  if (score >= 1) return "#fb923c";
  return "#f87171";
}

function getGlow(score: number): string {
  if (score >= 4) return "0 0 20px rgba(52,211,153,0.4)";
  if (score >= 3) return "0 0 20px rgba(163,230,53,0.4)";
  if (score >= 2) return "0 0 20px rgba(251,191,36,0.4)";
  return "0 0 20px rgba(248,113,113,0.4)";
}

interface Props {
  regions: Region[];
  onRegionClick: (region: Region) => void;
  selectedRegion?: string;
}

export default function BiodiversityMap({ regions, onRegionClick, selectedRegion }: Props) {
  return (
    <div className="glass rounded-2xl p-1 glow-green">
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        minZoom={3}
        maxZoom={8}
        className="h-[500px] md:h-[600px] w-full rounded-2xl"
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
        />
        {regions.map((region) => {
          const coords = REGION_COORDS[region.region];
          if (!coords) return null;
          const isSelected = selectedRegion === region.region;
          const radius = Math.max(12, Math.min(35, region.unique_species / 8));
          return (
            <CircleMarker
              key={region.region}
              center={coords}
              radius={isSelected ? radius + 5 : radius}
              fillColor={getColor(region.biodiversity_score)}
              fillOpacity={isSelected ? 0.9 : 0.6}
              color={isSelected ? "#fff" : getColor(region.biodiversity_score)}
              weight={isSelected ? 3 : 1.5}
              eventHandlers={{ click: () => onRegionClick(region) }}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                className="!bg-gray-900 !text-white !border-white/10 !rounded-xl !px-4 !py-3 !shadow-2xl"
              >
                <div className="text-center">
                  <div className="font-bold text-sm">{region.region}</div>
                  <div className="text-emerald-400 font-semibold text-lg">{region.biodiversity_score}</div>
                  <div className="text-white/50 text-xs">{region.unique_species} species</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
