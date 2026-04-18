"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
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
  if (score >= 4) return "#22c55e";
  if (score >= 3) return "#84cc16";
  if (score >= 2) return "#eab308";
  if (score >= 1) return "#f97316";
  return "#ef4444";
}

interface Props {
  regions: Region[];
  onRegionClick: (region: Region) => void;
}

export default function BiodiversityMap({ regions, onRegionClick }: Props) {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      className="h-[500px] w-full rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {regions.map((region) => {
        const coords = REGION_COORDS[region.region];
        if (!coords) return null;
        return (
          <CircleMarker
            key={region.region}
            center={coords}
            radius={Math.max(10, Math.min(30, region.unique_species / 10))}
            fillColor={getColor(region.biodiversity_score)}
            fillOpacity={0.7}
            color="#fff"
            weight={2}
            eventHandlers={{ click: () => onRegionClick(region) }}
          >
            <Tooltip>
              <strong>{region.region}</strong><br />
              Score: {region.biodiversity_score}<br />
              Species: {region.unique_species}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
