"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Rectangle } from "react-leaflet";
import { useState, useEffect } from "react";
import type { Zone } from "@/lib/speciesData";
import "leaflet/dist/leaflet.css";

const LAT_MIN = 32.53, LAT_MAX = 33.22;
const LNG_MIN = -117.60, LNG_MAX = -116.08;
const GRID_ROWS = 7, GRID_COLS = 7;

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "#34d399";
    case "B": return "#6ee7b7";
    case "C": return "#fbbf24";
    case "D": return "#fb923c";
    case "F": return "#ef4444";
    default: return "#64748b";
  }
}

interface Props {
  onZoneClick: (zone: Zone) => void;
  selectedZoneId?: string;
}

export default function ThreatMap({ onZoneClick, selectedZoneId }: Props) {
  const [zoneData, setZoneData] = useState<Zone[]>([]);
  useEffect(() => {
    fetch("/data/site-metadata.json").then(r => r.json()).then(d => setZoneData(d.zones));
  }, []);
  const latStep = (LAT_MAX - LAT_MIN) / GRID_ROWS;
  const lngStep = (LNG_MAX - LNG_MIN) / GRID_COLS;

  return (
    <div className="glass rounded-2xl p-1 relative">
      <MapContainer
        center={[32.85, -116.85]}
        zoom={9}
        className="h-[550px] md:h-[650px] w-full rounded-2xl"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />
        {zoneData.map((zone) => {
          const [r, c] = zone.id.split("-").map(Number);
          const isSelected = selectedZoneId === zone.id;
          const bounds: [[number, number], [number, number]] = [
            [LAT_MIN + r * latStep, LNG_MIN + c * lngStep],
            [LAT_MIN + (r + 1) * latStep, LNG_MIN + (c + 1) * lngStep],
          ];

          return (
            <Rectangle
              key={zone.id}
              bounds={bounds}
              pathOptions={{
                color: isSelected ? "#fff" : gradeColor(zone.health.grade),
                weight: isSelected ? 2.5 : 1,
                fillColor: gradeColor(zone.health.grade),
                fillOpacity: isSelected ? 0.5 : 0.25 + (1 - zone.health.score / 100) * 0.3,
              }}
              eventHandlers={{ click: () => onZoneClick(zone as unknown as Zone) }}
            >
              <Tooltip
                direction="top"
                className="!bg-gray-900/95 !backdrop-blur-sm !text-white !border-white/10 !rounded-xl !px-4 !py-3 !shadow-2xl"
              >
                <div className="text-center min-w-[140px]">
                  <div className="font-bold text-sm mb-1">{zone.name}</div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span
                      className="text-2xl font-black"
                      style={{ color: gradeColor(zone.health.grade) }}
                    >
                      {zone.health.grade}
                    </span>
                    <span className="text-white/40 text-xs">({zone.health.score})</span>
                  </div>
                  <div className="text-white/50 text-xs">{zone.total_species} threatened species</div>
                  <div className="text-white/30 text-[10px] mt-1">
                    {zone.health.trophic_completeness}% trophic completeness
                  </div>
                </div>
              </Tooltip>
            </Rectangle>
          );
        })}
      </MapContainer>
    </div>
  );
}
