import { geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { POSTAL } from "../gpu/map";

// US states in the Albers projection that us-atlas ships, 975 by 610 units.
export interface MapData { d: string; cent: Record<string, [number, number]>; w: number; h: number }

let mapData: Promise<MapData> | null = null;
export function loadMapData() {
  return (mapData ??= (async () => {
    const us = (await import("us-atlas/states-albers-10m.json")).default as unknown as Topology;
    const states = us.objects.states as GeometryCollection<{ name: string }>;
    const path = geoPath();
    const cent: MapData["cent"] = {};
    for (const f of feature(us, states).features) cent[POSTAL[f.properties.name] ?? ""] = path.centroid(f);
    return { d: path(mesh(us, states))!, cent, w: 975, h: 610 };
  })());
}
