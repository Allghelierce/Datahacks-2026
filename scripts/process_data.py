import csv
import json
import math
from collections import Counter, defaultdict

INPUT = "data/threatened_species.csv"
OUTPUT = "frontend/src/lib/speciesData.ts"

TROPHIC_MAP = {
    "Plantae": {"level": "producer", "label": "Producers", "order": 0},
    "Fungi": {"level": "decomposer", "label": "Decomposers", "order": 5},
    "Insecta": {"level": "primary_consumer", "label": "Primary Consumers", "order": 1},
    "Mollusca": {"level": "primary_consumer", "label": "Primary Consumers", "order": 1},
    "Amphibia": {"level": "secondary_consumer", "label": "Secondary Consumers", "order": 2},
    "Actinopterygii": {"level": "secondary_consumer", "label": "Secondary Consumers", "order": 2},
    "Reptilia": {"level": "secondary_consumer", "label": "Secondary Consumers", "order": 2},
    "Mammalia": {"level": "tertiary_consumer", "label": "Tertiary Consumers", "order": 3},
    "Aves": {"level": "tertiary_consumer", "label": "Tertiary Consumers", "order": 3},
    "Animalia": {"level": "primary_consumer", "label": "Primary Consumers", "order": 1},
}

POLLINATOR_ORDERS = {"Lepidoptera", "Hymenoptera"}
PREDATOR_ORDERS = {"Accipitriformes", "Falconiformes", "Strigiformes", "Carnivora", "Squamata"}

DEPENDENCY_CHAINS = [
    {"from": "producer", "to": "primary_consumer", "label": "food source"},
    {"from": "producer", "to": "pollinator", "label": "pollination"},
    {"from": "primary_consumer", "to": "secondary_consumer", "label": "prey"},
    {"from": "primary_consumer", "to": "tertiary_consumer", "label": "prey"},
    {"from": "pollinator", "to": "secondary_consumer", "label": "prey"},
    {"from": "pollinator", "to": "tertiary_consumer", "label": "prey"},
    {"from": "secondary_consumer", "to": "tertiary_consumer", "label": "prey"},
    {"from": "secondary_consumer", "to": "apex_predator", "label": "prey"},
    {"from": "tertiary_consumer", "to": "apex_predator", "label": "prey"},
    {"from": "decomposer", "to": "producer", "label": "nutrient cycling"},
]

LAT_MIN, LAT_MAX = 32.53, 33.22
LNG_MIN, LNG_MAX = -117.60, -116.08
GRID_ROWS, GRID_COLS = 7, 7

ZONE_NAMES = {
    (0, 0): "Border Field", (0, 1): "Otay Mesa", (0, 2): "Otay Mountain",
    (0, 3): "Tecate", (0, 4): "Campo", (0, 5): "Jacumba", (0, 6): "Mountain Empire",
    (1, 0): "Imperial Beach", (1, 1): "Chula Vista", (1, 2): "Jamul",
    (1, 3): "Alpine", (1, 4): "Pine Valley", (1, 5): "Mount Laguna", (1, 6): "Anza-Borrego South",
    (2, 0): "Coronado", (2, 1): "National City", (2, 2): "Spring Valley",
    (2, 3): "El Cajon", (2, 4): "Cuyamaca", (2, 5): "Julian", (2, 6): "Anza-Borrego Central",
    (3, 0): "Point Loma", (3, 1): "Downtown SD", (3, 2): "Mission Valley",
    (3, 3): "Santee", (3, 4): "Ramona", (3, 5): "Santa Ysabel", (3, 6): "Borrego Springs",
    (4, 0): "Mission Bay", (4, 1): "Balboa Park", (4, 2): "Mission Trails",
    (4, 3): "Poway", (4, 4): "San Pasqual", (4, 5): "Palomar Mountain", (4, 6): "Anza-Borrego North",
    (5, 0): "La Jolla", (5, 1): "Miramar", (5, 2): "Scripps Ranch",
    (5, 3): "Rancho Bernardo", (5, 4): "Escondido", (5, 5): "Valley Center", (5, 6): "Palomar East",
    (6, 0): "Del Mar", (6, 1): "Carmel Valley", (6, 2): "Rancho Santa Fe",
    (6, 3): "San Marcos", (6, 4): "Vista", (6, 5): "Fallbrook", (6, 6): "Temecula Border",
}

with open(INPUT) as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Loaded {len(rows)} observations")

def get_zone(lat, lng):
    r = int((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * GRID_ROWS)
    c = int((lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * GRID_COLS)
    r = max(0, min(GRID_ROWS - 1, r))
    c = max(0, min(GRID_COLS - 1, c))
    return (r, c)

def get_trophic(iconic, order):
    if order in POLLINATOR_ORDERS:
        return "pollinator", "Pollinators", 1.5
    if order in PREDATOR_ORDERS:
        return "apex_predator", "Apex Predators", 4
    info = TROPHIC_MAP.get(iconic, {"level": "unknown", "label": "Unknown", "order": -1})
    return info["level"], info["label"], info["order"]

zones = defaultdict(lambda: {
    "observations": [],
    "species": set(),
    "trophic_counts": Counter(),
    "trophic_species": defaultdict(set),
    "orders": Counter(),
    "yearly_species": defaultdict(set),
    "families": Counter(),
})

all_species = {}
species_zones = defaultdict(set)
species_observations = Counter()
species_yearly_obs = defaultdict(lambda: Counter())

for row in rows:
    try:
        lat = float(row["latitude"])
        lng = float(row["longitude"])
    except (ValueError, KeyError):
        continue

    zone = get_zone(lat, lng)
    iconic = row.get("iconic_taxon_name", "")
    order = row.get("taxon_order_name", "")
    sci_name = row.get("scientific_name", "")
    common_name = row.get("common_name", "")
    year = row.get("observed_on", "")[:4]
    family = row.get("taxon_family_name", "")
    taxon_class = row.get("taxon_class_name", "")

    if not sci_name:
        continue

    trophic_level, trophic_label, trophic_order = get_trophic(iconic, order)

    z = zones[zone]
    z["species"].add(sci_name)
    z["trophic_counts"][trophic_level] += 1
    z["trophic_species"][trophic_level].add(sci_name)
    z["orders"][order] += 1
    z["families"][family] += 1
    if year:
        z["yearly_species"][year].add(sci_name)

    species_zones[sci_name].add(zone)
    species_observations[sci_name] += 1
    if year:
        species_yearly_obs[sci_name][year] += 1

    if sci_name not in all_species:
        all_species[sci_name] = {
            "scientific_name": sci_name,
            "common_name": common_name,
            "iconic_taxon": iconic,
            "taxon_class": taxon_class,
            "order": order,
            "family": family,
            "trophic_level": trophic_level,
            "trophic_label": trophic_label,
        }


def compute_decline_trend(sci_name):
    """Compute YoY observation trend for a species. Returns % change."""
    yearly = species_yearly_obs[sci_name]
    if len(yearly) < 2:
        return 0.0
    years = sorted(yearly.keys())
    first_year = years[0]
    last_year = years[-1]
    first_count = yearly[first_year]
    last_count = yearly[last_year]
    if first_count == 0:
        return 0.0
    return round((last_count - first_count) / first_count * 100, 1)


def compute_health(zone_data):
    trophic = zone_data["trophic_species"]
    total_species = len(zone_data["species"])
    if total_species == 0:
        return {"grade": "N/A", "score": 0, "risks": [], "trophic_completeness": 0}

    expected_levels = ["producer", "pollinator", "primary_consumer", "secondary_consumer", "tertiary_consumer", "apex_predator"]
    present = sum(1 for l in expected_levels if len(trophic.get(l, set())) > 0)
    completeness = present / len(expected_levels)

    diversity_scores = []
    for level in expected_levels:
        count = len(trophic.get(level, set()))
        if count > 0:
            diversity_scores.append(min(count / 10, 1.0))

    avg_diversity = sum(diversity_scores) / len(diversity_scores) if diversity_scores else 0

    yearly = zone_data["yearly_species"]
    years_sorted = sorted(yearly.keys())
    trend = 0
    if len(years_sorted) >= 2:
        first = len(yearly[years_sorted[0]])
        last = len(yearly[years_sorted[-1]])
        trend = (last - first) / max(first, 1)

    score = (completeness * 0.4 + avg_diversity * 0.3 + min(max(trend + 0.5, 0), 1) * 0.3) * 100
    score = round(min(max(score, 0), 100), 1)

    if score >= 80: grade = "A"
    elif score >= 65: grade = "B"
    elif score >= 50: grade = "C"
    elif score >= 35: grade = "D"
    else: grade = "F"

    risks = []
    if len(trophic.get("pollinator", set())) == 0:
        risks.append({"type": "critical", "message": "No pollinators detected \u2014 plant reproduction at risk"})
    elif len(trophic.get("pollinator", set())) < 3:
        risks.append({"type": "warning", "message": "Low pollinator diversity \u2014 ecosystem fragile"})

    if len(trophic.get("apex_predator", set())) == 0:
        risks.append({"type": "warning", "message": "No apex predators \u2014 prey populations may be uncontrolled"})

    if len(trophic.get("producer", set())) < 5:
        risks.append({"type": "critical", "message": "Very low plant diversity \u2014 base of food web is thin"})

    if trend < -0.2:
        risks.append({"type": "critical", "message": f"Species declining {abs(round(trend*100))}% year-over-year"})
    elif trend < 0:
        risks.append({"type": "warning", "message": f"Slight species decline detected ({abs(round(trend*100))}%)"})

    if completeness < 0.5:
        risks.append({"type": "critical", "message": f"Only {present}/{len(expected_levels)} trophic levels present \u2014 food web has major gaps"})

    return {
        "grade": grade,
        "score": score,
        "risks": risks,
        "trophic_completeness": round(completeness * 100),
        "trend_pct": round(trend * 100, 1),
    }


# Build zone summaries
zone_summaries = []
zone_id_to_key = {}
for (r, c), data in sorted(zones.items()):
    name = ZONE_NAMES.get((r, c), f"Zone {r}-{c}")
    health = compute_health(data)

    center_lat = LAT_MIN + (r + 0.5) / GRID_ROWS * (LAT_MAX - LAT_MIN)
    center_lng = LNG_MIN + (c + 0.5) / GRID_COLS * (LNG_MAX - LNG_MIN)

    trophic_breakdown = {}
    for level in ["producer", "pollinator", "primary_consumer", "secondary_consumer", "tertiary_consumer", "apex_predator", "decomposer"]:
        species_list = sorted(data["trophic_species"].get(level, set()))
        trophic_breakdown[level] = {
            "count": len(species_list),
            "species": species_list[:15],
        }

    yearly_counts = {}
    for year, sp in sorted(data["yearly_species"].items()):
        yearly_counts[year] = len(sp)

    zone_id = f"{r}-{c}"
    zone_id_to_key[zone_id] = (r, c)
    zone_summaries.append({
        "id": zone_id,
        "name": name,
        "lat": round(center_lat, 4),
        "lng": round(center_lng, 4),
        "total_species": len(data["species"]),
        "total_observations": sum(data["trophic_counts"].values()),
        "health": health,
        "trophic": trophic_breakdown,
        "yearly_species": yearly_counts,
        "top_families": dict(data["families"].most_common(8)),
    })


# ─── Build global dependency graph ───
dependency_nodes = []
dependency_edges = []

# Ensure minimum representation from each trophic level
MIN_PER_LEVEL = 5
all_by_level = defaultdict(list)
for sp in all_species.values():
    all_by_level[sp["trophic_level"]].append(sp)
for level in all_by_level:
    all_by_level[level].sort(key=lambda s: species_observations[s["scientific_name"]], reverse=True)

top_species_set = set()
# First, guarantee minimum per level
for level, sps in all_by_level.items():
    for sp in sps[:MIN_PER_LEVEL]:
        top_species_set.add(sp["scientific_name"])
# Then fill remaining slots from top by observation count
all_sorted = sorted(all_species.values(), key=lambda s: species_observations[s["scientific_name"]], reverse=True)
for sp in all_sorted:
    if len(top_species_set) >= 60:
        break
    top_species_set.add(sp["scientific_name"])

top_species = [all_species[sid] for sid in top_species_set]
top_species.sort(key=lambda s: species_observations[s["scientific_name"]], reverse=True)
top_species_ids = {sp["scientific_name"] for sp in top_species}

for sp in top_species:
    sid = sp["scientific_name"]
    dependency_nodes.append({
        "id": sid,
        "common_name": sp["common_name"],
        "trophic_level": sp["trophic_level"],
        "trophic_label": sp["trophic_label"],
        "iconic_taxon": sp["iconic_taxon"],
        "order": sp["order"],
        "family": sp["family"],
        "observations": species_observations[sid],
        "zone_count": len(species_zones[sid]),
        "decline_trend": compute_decline_trend(sid),
    })

node_by_level = defaultdict(list)
for node in dependency_nodes:
    node_by_level[node["trophic_level"]].append(node)

# Build edges with realistic specialization:
# - Species with narrow ranges (few zones) are specialists → 1 food source
# - Species with medium ranges → 2 food sources
# - Widespread species → 3 food sources
# This creates natural vulnerability: narrow-range species cascade easily

for chain in DEPENDENCY_CHAINS:
    from_nodes = node_by_level.get(chain["from"], [])
    to_nodes = node_by_level.get(chain["to"], [])

    for tn in to_nodes:
        tn_zones = species_zones[tn["id"]]
        if not tn_zones:
            continue

        zone_count = len(tn_zones)
        if zone_count <= 10:
            max_src = 1
        elif zone_count <= 25:
            max_src = 2
        else:
            max_src = 3

        candidates = []
        for fn in from_nodes:
            if fn["id"] == tn["id"]:
                continue
            fn_zones = species_zones[fn["id"]]
            overlap = len(fn_zones & tn_zones)
            if overlap > 0:
                strength = round(overlap / max(zone_count, 1), 2)
                candidates.append((fn, strength, overlap))

        candidates.sort(key=lambda x: x[1], reverse=True)
        for fn, strength, overlap in candidates[:max_src]:
            dependency_edges.append({
                "source": fn["id"],
                "target": tn["id"],
                "type": chain["label"],
                "strength": strength,
            })


# ─── Keystone score computation ───
def compute_cascade_victims(removed_id, nodes, edges, threshold=0.4):
    """Cascade with strength-weighted dependency.
    A species collapses if surviving food sources provide less than threshold
    of its original total incoming strength."""
    incoming_strength = defaultdict(float)
    for e in edges:
        incoming_strength[e["target"]] += e["strength"]

    removed = {removed_id}
    changed = True
    while changed:
        changed = False
        for node in nodes:
            if node["id"] in removed:
                continue
            total = incoming_strength.get(node["id"], 0)
            if total == 0:
                continue
            surviving = sum(e["strength"] for e in edges
                          if e["target"] == node["id"] and e["source"] not in removed)
            if surviving / total < threshold:
                removed.add(node["id"])
                changed = True
    removed.discard(removed_id)
    return removed


def count_trophic_levels(victim_ids, nodes):
    """Count how many distinct trophic levels are affected."""
    levels = set()
    for n in nodes:
        if n["id"] in victim_ids:
            levels.add(n["trophic_level"])
    return len(levels)


print("\nComputing keystone scores...")
node_count = len(dependency_nodes)
keystone_data = {}

for node in dependency_nodes:
    victims = compute_cascade_victims(node["id"], dependency_nodes, dependency_edges)
    score = len(victims) / max(node_count - 1, 1)
    trophic_levels_hit = count_trophic_levels(victims, dependency_nodes)
    keystone_data[node["id"]] = {
        "keystone_score": round(score, 3),
        "cascade_victims": sorted(victims),
        "trophic_levels_affected": trophic_levels_hit,
    }

# Attach keystone_score to dependency_nodes
for node in dependency_nodes:
    kd = keystone_data[node["id"]]
    node["keystone_score"] = kd["keystone_score"]
    node["cascade_victim_count"] = len(kd["cascade_victims"])
    node["trophic_levels_affected"] = kd["trophic_levels_affected"]

# Build KEYSTONE_RANKINGS (sorted by keystone_score desc)
keystone_rankings = []
for node in sorted(dependency_nodes, key=lambda n: n["keystone_score"], reverse=True):
    kd = keystone_data[node["id"]]
    if kd["keystone_score"] > 0:
        victim_names = []
        for vid in kd["cascade_victims"]:
            for n in dependency_nodes:
                if n["id"] == vid:
                    victim_names.append(n["common_name"] or vid)
                    break
        keystone_rankings.append({
            "id": node["id"],
            "common_name": node["common_name"],
            "trophic_level": node["trophic_level"],
            "keystone_score": kd["keystone_score"],
            "decline_trend": node["decline_trend"],
            "cascade_victims": kd["cascade_victims"],
            "cascade_victim_names": victim_names,
            "trophic_levels_affected": kd["trophic_levels_affected"],
            "zones_present": node["zone_count"],
            "observations": node["observations"],
            "priority": "critical" if kd["keystone_score"] >= 0.15 and node["decline_trend"] < -10 else
                        "high" if kd["keystone_score"] >= 0.1 or node["decline_trend"] < -20 else
                        "medium" if kd["keystone_score"] > 0 else "low",
        })

print(f"Keystone rankings: {len(keystone_rankings)} species with cascade impact")
for kr in keystone_rankings[:5]:
    print(f"  {kr['common_name']}: score={kr['keystone_score']}, victims={len(kr['cascade_victims'])}, trend={kr['decline_trend']}%")


# ─── Zone-specific dependency subgraphs ───
print("\nBuilding zone dependency subgraphs...")
zone_dependency_graphs = {}

for zs in zone_summaries:
    zone_key = zone_id_to_key[zs["id"]]
    zone_species = zones[zone_key]["species"]

    zone_node_ids = top_species_ids & zone_species
    if len(zone_node_ids) < 2:
        continue

    zone_nodes = []
    for node in dependency_nodes:
        if node["id"] in zone_node_ids:
            zone_nodes.append({
                "id": node["id"],
                "common_name": node["common_name"],
                "trophic_level": node["trophic_level"],
                "observations": node["observations"],
                "decline_trend": node["decline_trend"],
                "keystone_score": node["keystone_score"],
            })

    zone_edges = []
    for edge in dependency_edges:
        if edge["source"] in zone_node_ids and edge["target"] in zone_node_ids:
            zone_edges.append(edge)

    # Compute zone-local keystone scores
    if len(zone_nodes) > 1:
        for zn in zone_nodes:
            local_victims = compute_cascade_victims(zn["id"], zone_nodes, zone_edges)
            zn["zone_keystone_score"] = round(len(local_victims) / max(len(zone_nodes) - 1, 1), 3)
    else:
        for zn in zone_nodes:
            zn["zone_keystone_score"] = 0.0

    zone_dependency_graphs[zs["id"]] = {
        "nodes": zone_nodes,
        "edges": zone_edges,
    }

print(f"Built subgraphs for {len(zone_dependency_graphs)} zones")

# Build zone keystone rankings (top keystones per zone, sorted by zone_keystone_score)
zone_keystone_rankings = {}
for zid, zg in zone_dependency_graphs.items():
    ranked = sorted(
        [n for n in zg["nodes"] if n.get("zone_keystone_score", 0) > 0],
        key=lambda n: n["zone_keystone_score"],
        reverse=True,
    )
    if ranked:
        # Compute cascade victims for each zone keystone
        zone_rankings = []
        for zn in ranked:
            local_victims = compute_cascade_victims(zn["id"], zg["nodes"], zg["edges"])
            victim_names = [n["common_name"] for n in zg["nodes"] if n["id"] in local_victims]
            victim_levels = count_trophic_levels(local_victims, zg["nodes"])
            zone_rankings.append({
                "id": zn["id"],
                "common_name": zn["common_name"],
                "trophic_level": zn["trophic_level"],
                "zone_keystone_score": zn["zone_keystone_score"],
                "decline_trend": zn["decline_trend"],
                "cascade_victim_count": len(local_victims),
                "cascade_victim_names": victim_names,
                "trophic_levels_affected": victim_levels,
                "priority": "critical" if zn["zone_keystone_score"] >= 0.3 and zn["decline_trend"] < -10 else
                            "high" if zn["zone_keystone_score"] >= 0.2 or zn["decline_trend"] < -20 else
                            "medium" if zn["zone_keystone_score"] > 0 else "low",
            })
        zone_keystone_rankings[zid] = zone_rankings

zones_with_keystones = sum(1 for v in zone_keystone_rankings.values() if v)
critical_count = sum(1 for v in zone_keystone_rankings.values() for r in v if r["priority"] == "critical")
print(f"Zone keystone rankings: {zones_with_keystones} zones with keystones, {critical_count} critical-priority species")


# ─── Collapse predictions ───
collapse_predictions = []
for zs in zone_summaries:
    if zs["health"]["grade"] in ("D", "F"):
        missing = []
        for level, data in zs["trophic"].items():
            if data["count"] == 0 and level != "decomposer":
                missing.append(level.replace("_", " ").title())

        at_risk_species = []
        if zs["trophic"]["pollinator"]["count"] == 0:
            at_risk_species.extend(zs["trophic"]["producer"]["species"][:5])
        if zs["trophic"]["producer"]["count"] < 3:
            for level in ["primary_consumer", "pollinator"]:
                at_risk_species.extend(zs["trophic"][level]["species"][:3])

        if missing or at_risk_species:
            collapse_predictions.append({
                "zone": zs["name"],
                "zone_id": zs["id"],
                "grade": zs["health"]["grade"],
                "score": zs["health"]["score"],
                "missing_levels": missing,
                "at_risk_species": at_risk_species[:8],
                "risks": zs["health"]["risks"],
            })


# ─── Global stats ───
total_species = len(all_species)
total_obs = len(rows)
global_trophic = Counter()
for sp in all_species.values():
    global_trophic[sp["trophic_level"]] += 1

print(f"\nProcessed {len(zone_summaries)} zones")
print(f"Total species: {total_species}")
print(f"Dependency graph: {len(dependency_nodes)} nodes, {len(dependency_edges)} edges")
print(f"Collapse predictions: {len(collapse_predictions)} zones at risk")
print(f"Global trophic: {dict(global_trophic)}")


# ─── Write TypeScript ───
ts_output = f'''// Auto-generated from {INPUT} — {total_obs} observations, {total_species} species
// Do not edit manually

export const ZONE_DATA = {json.dumps(zone_summaries, indent=2)} as const;

export const DEPENDENCY_NODES = {json.dumps(dependency_nodes, indent=2)} as const;

export const DEPENDENCY_EDGES = {json.dumps(dependency_edges, indent=2)} as const;

export const KEYSTONE_RANKINGS = {json.dumps(keystone_rankings, indent=2)} as const;

export interface ZoneNode {{
  id: string;
  common_name: string;
  trophic_level: string;
  observations: number;
  decline_trend: number;
  keystone_score: number;
  zone_keystone_score: number;
}}

export interface ZoneKeystoneEntry {{
  id: string;
  common_name: string;
  trophic_level: string;
  zone_keystone_score: number;
  decline_trend: number;
  cascade_victim_count: number;
  cascade_victim_names: string[];
  trophic_levels_affected: number;
  priority: "critical" | "high" | "medium" | "low";
}}

export const ZONE_DEPENDENCY_GRAPHS: Record<string, {{ nodes: ZoneNode[]; edges: DependencyEdge[] }}> = {json.dumps(zone_dependency_graphs, indent=2)};

export const ZONE_KEYSTONE_RANKINGS: Record<string, ZoneKeystoneEntry[]> = {json.dumps(zone_keystone_rankings, indent=2)};

export const COLLAPSE_PREDICTIONS = {json.dumps(collapse_predictions, indent=2)} as const;

export const GLOBAL_STATS = {{
  totalSpecies: {total_species},
  totalObservations: {total_obs},
  totalZones: {len(zone_summaries)},
  zonesAtRisk: {len(collapse_predictions)},
  trophicBreakdown: {json.dumps(dict(global_trophic))},
  healthDistribution: {json.dumps(dict(Counter(z["health"]["grade"] for z in zone_summaries)))},
}} as const;

export type Zone = typeof ZONE_DATA[number];
export type DependencyNode = typeof DEPENDENCY_NODES[number];
export type DependencyEdge = typeof DEPENDENCY_EDGES[number];
export type KeystoneRanking = typeof KEYSTONE_RANKINGS[number];
export type CollapsePrediction = typeof COLLAPSE_PREDICTIONS[number];
export type ZoneDependencyGraph = {{ nodes: ZoneNode[]; edges: DependencyEdge[] }};
'''

with open(OUTPUT, "w") as f:
    f.write(ts_output)

print(f"\nWrote {OUTPUT}")
