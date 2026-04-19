import csv
import json
import math
import os
import random
from collections import Counter, defaultdict

INPUT_DIR = "data"
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
    "Animalia": {"level": "secondary_consumer", "label": "Secondary Consumers", "order": 2},
}

POLLINATOR_ORDERS = {"Lepidoptera", "Hymenoptera"}
PREDATOR_ORDERS = {"Accipitriformes", "Falconiformes", "Strigiformes", "Carnivora", "Squamata"}
SECONDARY_ORDERS = {"Rajiformes", "Myliobatiformes", "Perciformes", "Scorpaeniformes",
                    "Pleuronectiformes", "Tetraodontiformes", "Siluriformes",
                    "Coleoptera", "Orthoptera", "Hemiptera", "Odonata", "Mantodea"}
TERTIARY_ORDERS = {"Lamniformes", "Carcharhiniformes", "Pelecaniformes", "Suliformes",
                   "Charadriiformes", "Anseriformes"}

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

ECOSYSTEM_TYPES = {
    "Pacific Coast & Tidepools": {
        "zones": ["Border Field", "Imperial Beach", "Coronado", "Point Loma", "Mission Bay", "La Jolla", "Del Mar"],
        "description": "San Diego's 70-mile coastline — tidepools, kelp forests, salt marshes, and coastal bluffs from the Tijuana Estuary to Torrey Pines",
        "keywords": ["ocean", "coastal", "marine", "tidepool", "beach", "shore", "sea", "kelp", "reef", "surf", "pier",
                      "pacific beach", "ocean beach", "la jolla shores", "torrey pines", "blacks beach", "windansea",
                      "sunset cliffs", "cabrillo", "shelter island", "harbor", "bay", "seaworld", "fiesta island",
                      "mission beach", "bird rock", "children's pool", "scripps pier", "del mar beach"],
    },
    "Coastal Sage & Mesa": {
        "zones": ["Otay Mesa", "Chula Vista", "National City", "Spring Valley", "Mission Valley", "Balboa Park", "Miramar"],
        "description": "San Diego's endangered coastal sage scrub — low aromatic shrubs on mesas and terraces, home to the California gnatcatcher",
        "keywords": ["sage", "scrub", "mesa", "otay", "chula vista", "national city", "spring valley", "sweetwater",
                      "bonita", "eastlake", "otay ranch", "rolling hills", "paradise hills", "encanto",
                      "lincoln park", "southeast sd", "logan heights", "barrio logan", "sherman heights",
                      "kensington", "talmadge", "city heights", "college area", "sdsu", "del cerro"],
    },
    "Chaparral & Canyons": {
        "zones": ["Jamul", "Alpine", "Santee", "Mission Trails", "Poway", "Scripps Ranch", "Rancho Santa Fe", "Carmel Valley"],
        "description": "Fire-adapted chaparral covering San Diego's inland hills and canyon systems — dense shrubland with seasonal wildflower blooms",
        "keywords": ["chaparral", "canyon", "hills", "brush", "fire", "trail", "hiking",
                      "mission trails", "cowles mountain", "fortuna mountain", "poway", "iron mountain",
                      "lake poway", "santee", "mission gorge", "tierrasanta", "scripps ranch",
                      "rancho penasquitos", "black mountain", "torrey highlands", "4s ranch", "santaluz",
                      "carmel valley", "del mar heights", "los penasquitos canyon", "rose canyon",
                      "tecolote canyon", "bressi ranch", "pacific highlands ranch"],
    },
    "Cuyamaca & Laguna Mountains": {
        "zones": ["Otay Mountain", "Pine Valley", "Mount Laguna", "Cuyamaca", "Julian", "Palomar Mountain", "Palomar East"],
        "description": "San Diego's mountain backbone — mixed conifer forests, oak woodlands, and alpine meadows from Cuyamaca Peak to Palomar Observatory",
        "keywords": ["mountain", "forest", "pine", "oak", "conifer", "woodland", "elevation",
                      "cuyamaca", "julian", "mount laguna", "palomar", "sunrise highway",
                      "stonewall peak", "green valley falls", "william heise", "volcan mountain",
                      "hot springs mountain", "pine valley", "descanso", "guatay", "mount woodson",
                      "observatory", "doane valley", "boucher hill"],
    },
    "Anza-Borrego Desert": {
        "zones": ["Anza-Borrego South", "Anza-Borrego Central", "Anza-Borrego North", "Borrego Springs"],
        "description": "California's largest state park in San Diego's eastern desert — slot canyons, badlands, palm oases, and spring wildflower superbloom",
        "keywords": ["desert", "arid", "anza-borrego", "borrego", "cactus", "dry", "sand", "dune", "succulent",
                      "borrego springs", "fonts point", "badlands", "slot canyon", "palm canyon",
                      "the narrows", "wind caves", "elephant trees", "ocotillo", "superbloom",
                      "galleta meadows", "sculptures", "clark dry lake", "coyote canyon",
                      "hellhole canyon", "yaqui pass", "scissors crossing"],
    },
    "San Diego River & Inland Valleys": {
        "zones": ["Ramona", "San Pasqual", "Santa Ysabel", "Valley Center", "Escondido", "Rancho Bernardo", "El Cajon"],
        "description": "San Diego's inland valleys and riparian corridors — the San Diego River watershed, San Pasqual Valley, and agricultural lands of the backcountry",
        "keywords": ["river", "stream", "riparian", "creek", "valley", "wetland", "lake", "pond", "freshwater",
                      "san diego river", "san pasqual", "escondido", "rancho bernardo", "el cajon",
                      "ramona", "lakeside", "flinn springs", "harbison canyon", "dehesa",
                      "san vicente reservoir", "el capitan reservoir", "lake hodges", "lake wohlford",
                      "dixon lake", "kit carson park", "daley ranch", "elfin forest",
                      "santa ysabel", "valley center", "bonsall"],
    },
    "South Bay & Border Lands": {
        "zones": ["Tecate", "Campo", "Jacumba", "Mountain Empire", "Temecula Border", "Fallbrook", "Vista", "San Marcos"],
        "description": "San Diego's borderlands and transition zones — where coastal, desert, and mountain ecosystems converge with unique cross-border wildlife corridors",
        "keywords": ["border", "transition", "south bay", "campo", "tecate", "jacumba",
                      "fallbrook", "vista", "san marcos", "oceanside", "carlsbad",
                      "san elijo", "batiquitos lagoon", "buena vista lagoon",
                      "lake san marcos", "double peak", "discovery hills",
                      "cal state san marcos", "palomar college", "temecula"],
    },
    "Urban Parks & Preserves": {
        "zones": ["Downtown SD", "Balboa Park", "Mission Trails", "Coronado"],
        "description": "San Diego's urban biodiversity hotspots — Balboa Park's 1,200 acres, Mission Trails Regional Park, and neighborhood green corridors",
        "keywords": ["urban", "park", "city", "garden", "backyard", "downtown", "gaslamp",
                      "balboa park", "zoo", "safari park", "presidio park", "old town",
                      "hillcrest", "north park", "south park", "golden hill", "bankers hill",
                      "little italy", "mission hills", "university heights", "normal heights",
                      "adams avenue", "uptown", "midtown", "coronado", "hotel del"],
    },
}

HABITAT_MAP = {
    "Plantae": "terrestrial",
    "Fungi": "terrestrial",
    "Insecta": "terrestrial",
    "Arachnida": "terrestrial",
    "Mammalia": "terrestrial",
    "Aves": "terrestrial",
    "Reptilia": "terrestrial",
    "Amphibia": "freshwater",
    "Actinopterygii": "aquatic",
    "Mollusca": "aquatic",
    "Animalia": "unknown",
}

MARINE_ORDERS = {
    "Myliobatiformes", "Lamniformes", "Carcharhiniformes", "Squatiniformes",
    "Rajiformes", "Synallactida", "Perciformes", "Scorpaeniformes",
}
MARINE_FAMILIES = {
    "Stichopodidae", "Haliotidae", "Dasyatidae", "Alopiidae", "Triakidae",
    "Squatinidae", "Rhinobatidae",
}

def get_habitat(iconic, order, family):
    if order in MARINE_ORDERS or family in MARINE_FAMILIES:
        return "marine"
    return HABITAT_MAP.get(iconic, "unknown")

def habitats_compatible(h1, h2):
    if h1 == "unknown" or h2 == "unknown":
        return True
    if h1 == h2:
        return True
    if {h1, h2} == {"freshwater", "terrestrial"}:
        return True
    return False

ZONE_NAME_TO_COORDS = {}  # populated after ZONE_NAMES

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

# Build reverse lookup: zone name → (r, c)
for (r, c), name in ZONE_NAMES.items():
    ZONE_NAME_TO_COORDS[name] = (r, c)

import glob

csv_files = glob.glob(os.path.join(INPUT_DIR, "*.csv"))
# Also check for nested CSV dirs (like observations-711984.csv/)
for entry in glob.glob("observations-*.csv"):
    nested = glob.glob(os.path.join(entry, "*.csv"))
    csv_files.extend(nested)

rows = []
seen_ids = set()
for csv_file in csv_files:
    print(f"Reading {csv_file}...")
    with open(csv_file) as f:
        reader = csv.DictReader(f)
        for row in reader:
            obs_id = row.get("id", "")
            if obs_id and obs_id in seen_ids:
                continue
            if obs_id:
                seen_ids.add(obs_id)
            rows.append(row)

print(f"Loaded {len(rows)} observations from {len(csv_files)} files ({len(seen_ids)} unique IDs)")

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
    if order in TERTIARY_ORDERS:
        return "tertiary_consumer", "Tertiary Consumers", 3
    if order in SECONDARY_ORDERS:
        return "secondary_consumer", "Secondary Consumers", 2
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
# Include ALL species — we have 505, enough for rich ecosystem variation
all_sorted = sorted(all_species.values(), key=lambda s: species_observations[s["scientific_name"]], reverse=True)
for sp in all_sorted:
    top_species_set.add(sp["scientific_name"])

top_species = [all_species[sid] for sid in top_species_set]
top_species.sort(key=lambda s: species_observations[s["scientific_name"]], reverse=True)
top_species_ids = {sp["scientific_name"] for sp in top_species}

species_habitat = {}
for sp in top_species:
    sid = sp["scientific_name"]
    habitat = get_habitat(sp["iconic_taxon"], sp["order"], sp["family"])
    species_habitat[sid] = habitat
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

# ─── GloBI: fetch real species interactions ───
import urllib.request
import urllib.parse
import time as _time

GLOBI_CACHE_FILE = "data/globi_cache.json"
GLOBI_INTERACTION_MAP = {
    "eats": "food source",
    "preysOn": "prey",
    "pollinates": "pollination",
    "parasiteOf": "parasitism",
    "interactsWith": "food source",
    "hasHost": "parasitism",
    "flowersVisitedBy": "pollination",
    "visitedBy": "pollination",
}

def load_globi_cache():
    if os.path.exists(GLOBI_CACHE_FILE):
        with open(GLOBI_CACHE_FILE) as f:
            return json.load(f)
    return {}

def save_globi_cache(cache):
    os.makedirs(os.path.dirname(GLOBI_CACHE_FILE), exist_ok=True)
    with open(GLOBI_CACHE_FILE, "w") as f:
        json.dump(cache, f)

def query_globi(taxon_name, cache):
    if taxon_name in cache:
        return cache[taxon_name]

    encoded = urllib.parse.quote(taxon_name)
    url = f"https://api.globalbioticinteractions.org/interaction?sourceTaxon={encoded}&type=json&limit=50"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BioScope/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        interactions = []
        for row in data.get("data", []):
            if len(row) >= 4:
                interaction_type = row[1] if len(row) > 1 else ""
                target_name = row[2] if len(row) > 2 else ""
                if target_name and interaction_type:
                    interactions.append({
                        "target": target_name,
                        "type": interaction_type,
                    })
        cache[taxon_name] = interactions
        return interactions
    except Exception as e:
        print(f"    GloBI error for {taxon_name}: {e}")
        cache[taxon_name] = []
        return []

print("\n─── Fetching GloBI interactions ───")
globi_cache = load_globi_cache()
cached_count = sum(1 for sid in top_species_ids if sid in globi_cache)
to_fetch = [sid for sid in top_species_ids if sid not in globi_cache]
print(f"  {cached_count} cached, {len(to_fetch)} to fetch")

globi_edges = []
globi_species_with_edges = set()

for i, sid in enumerate(to_fetch):
    if i > 0 and i % 10 == 0:
        print(f"  Fetched {i}/{len(to_fetch)}...")
    interactions = query_globi(sid, globi_cache)
    if i % 50 == 0:
        save_globi_cache(globi_cache)
    _time.sleep(0.15)

save_globi_cache(globi_cache)

for sid in top_species_ids:
    interactions = globi_cache.get(sid, [])
    for inter in interactions:
        target = inter["target"]
        itype = inter["type"]
        edge_type = GLOBI_INTERACTION_MAP.get(itype)
        if not edge_type:
            continue
        if target in top_species_ids and target != sid:
            sid_habitat = species_habitat.get(sid, "unknown")
            target_habitat = species_habitat.get(target, "unknown")
            if not habitats_compatible(sid_habitat, target_habitat):
                continue
            overlap = len(species_zones[sid] & species_zones[target])
            strength = round(overlap / max(len(species_zones[target]), 1), 2) if overlap > 0 else 0.5
            globi_edges.append({
                "source": sid,
                "target": target,
                "type": edge_type,
                "strength": max(strength, 0.3),
            })
            globi_species_with_edges.add(sid)
            globi_species_with_edges.add(target)

# Deduplicate GloBI edges
seen_edges = set()
for e in globi_edges:
    key = (e["source"], e["target"], e["type"])
    if key not in seen_edges:
        seen_edges.add(key)
        dependency_edges.append(e)

print(f"  GloBI: {len(seen_edges)} real edges from {len(globi_species_with_edges)} species")

# ─── Synthetic fallback for species without GloBI data ───
print("\nBuilding synthetic edges for species without GloBI data...")
synthetic_count = 0
MAX_INCOMING = 3
MAX_OUTGOING = 4

outgoing_count = defaultdict(int)
for e in dependency_edges:
    outgoing_count[e["source"]] += 1

for chain in DEPENDENCY_CHAINS:
    from_nodes = node_by_level.get(chain["from"], [])
    to_nodes = node_by_level.get(chain["to"], [])

    for tn in to_nodes:
        existing_sources = {e["source"] for e in dependency_edges if e["target"] == tn["id"]}
        if len(existing_sources) >= MAX_INCOMING:
            continue

        tn_zones = species_zones[tn["id"]]
        if not tn_zones:
            continue

        zone_count = len(tn_zones)
        need = max(0, MAX_INCOMING - len(existing_sources))

        tn_habitat = species_habitat.get(tn["id"], "unknown")
        tn_family = all_species.get(tn["id"], {}).get("family", "")
        candidates = []
        for fn in from_nodes:
            if fn["id"] == tn["id"] or fn["id"] in existing_sources:
                continue
            if outgoing_count[fn["id"]] >= MAX_OUTGOING:
                continue
            fn_habitat = species_habitat.get(fn["id"], "unknown")
            if not habitats_compatible(fn_habitat, tn_habitat):
                continue
            fn_zones = species_zones[fn["id"]]
            overlap = len(fn_zones & tn_zones)
            if overlap > 0:
                zone_score = overlap / max(zone_count, 1)
                family_bonus = 0.3 if all_species.get(fn["id"], {}).get("family", "") == tn_family else 0
                score = round(zone_score + family_bonus, 2)
                candidates.append((fn, score, overlap))

        candidates.sort(key=lambda x: x[1], reverse=True)
        for fn, score, overlap in candidates[:need]:
            edge_key = (fn["id"], tn["id"], chain["label"])
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                dependency_edges.append({
                    "source": fn["id"],
                    "target": tn["id"],
                    "type": chain["label"],
                    "strength": min(score, 1.0),
                })
                outgoing_count[fn["id"]] += 1
                synthetic_count += 1

print(f"  Synthetic fallback: {synthetic_count} edges added")
print(f"  Total edges: {len(dependency_edges)}")


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


# ─── Ecosystem-level subgraphs ───
print("\nBuilding ecosystem subgraphs...")
ecosystem_graphs = {}

for eco_name, eco_info in ECOSYSTEM_TYPES.items():
    eco_zone_keys = []
    for zone_name in eco_info["zones"]:
        if zone_name in ZONE_NAME_TO_COORDS:
            eco_zone_keys.append(ZONE_NAME_TO_COORDS[zone_name])

    # Collect all species observed in any of the ecosystem's zones
    eco_species = set()
    for zk in eco_zone_keys:
        if zk in zones:
            eco_species.update(zones[zk]["species"])

    eco_node_ids = top_species_ids & eco_species
    if len(eco_node_ids) < 3:
        continue

    # Cap at random 150-200: prioritize species with most observations in THIS ecosystem's zones
    eco_cap = 175
    if len(eco_node_ids) > eco_cap:
        # Count observations per species within this ecosystem's zones
        eco_obs = Counter()
        for zk in eco_zone_keys:
            if zk in zones:
                for row_data in zones[zk]["observations"] if "observations" in zones[zk] else []:
                    pass
        # Use zone overlap + observation count to rank species by ecosystem relevance
        eco_by_level = defaultdict(list)
        for nid in eco_node_ids:
            node = next(n for n in dependency_nodes if n["id"] == nid)
            # Score: observation count weighted by how many of THIS ecosystem's zones the species appears in
            sp_zones = species_zones[nid]
            eco_zone_set = set(eco_zone_keys)
            overlap = len(sp_zones & eco_zone_set)
            relevance = node["observations"] * (1 + overlap * 2)
            eco_by_level[node["trophic_level"]].append((nid, relevance))
        for lv in eco_by_level:
            eco_by_level[lv].sort(key=lambda x: x[1], reverse=True)
        # Guarantee trophic balance: top 8 per level
        kept = set()
        for lv, sps in eco_by_level.items():
            for sp_id, _ in sps[:8]:
                kept.add(sp_id)
        # Fill remaining by relevance score
        all_ranked = []
        for lv, sps in eco_by_level.items():
            for sp_id, score in sps:
                if sp_id not in kept:
                    all_ranked.append((sp_id, score))
        all_ranked.sort(key=lambda x: x[1], reverse=True)
        for nid, _ in all_ranked:
            if len(kept) >= eco_cap:
                break
            kept.add(nid)
        eco_node_ids = kept

    eco_nodes = []
    for node in dependency_nodes:
        if node["id"] in eco_node_ids:
            eco_nodes.append({
                "id": node["id"],
                "common_name": node["common_name"],
                "trophic_level": node["trophic_level"],
                "observations": node["observations"],
                "decline_trend": node["decline_trend"],
                "keystone_score": node["keystone_score"],
            })

    eco_edges = []
    for edge in dependency_edges:
        if edge["source"] in eco_node_ids and edge["target"] in eco_node_ids:
            eco_edges.append(edge)

    # Compute ecosystem-local keystone scores
    for en in eco_nodes:
        local_victims = compute_cascade_victims(en["id"], eco_nodes, eco_edges)
        en["zone_keystone_score"] = round(len(local_victims) / max(len(eco_nodes) - 1, 1), 3)

    # Top keystones for this ecosystem
    eco_keystones = sorted(
        [n for n in eco_nodes if n.get("zone_keystone_score", 0) > 0],
        key=lambda n: n["zone_keystone_score"],
        reverse=True,
    )[:5]

    eco_keystone_list = []
    for ek in eco_keystones:
        local_victims = compute_cascade_victims(ek["id"], eco_nodes, eco_edges)
        victim_names = [n["common_name"] for n in eco_nodes if n["id"] in local_victims]
        eco_keystone_list.append({
            "id": ek["id"],
            "common_name": ek["common_name"],
            "trophic_level": ek["trophic_level"],
            "zone_keystone_score": ek["zone_keystone_score"],
            "decline_trend": ek["decline_trend"],
            "cascade_victim_count": len(local_victims),
            "cascade_victim_names": victim_names,
        })

    # Zone-level health grades for this ecosystem
    eco_zone_ids = []
    for zk in eco_zone_keys:
        zid = f"{zk[0]}-{zk[1]}"
        for zs in zone_summaries:
            if zs["id"] == zid:
                eco_zone_ids.append({"id": zid, "name": zs["name"], "grade": zs["health"]["grade"], "score": zs["health"]["score"]})
                break

    ecosystem_graphs[eco_name] = {
        "description": eco_info["description"],
        "keywords": eco_info["keywords"],
        "zone_count": len(eco_zone_keys),
        "zones": eco_zone_ids,
        "nodes": eco_nodes,
        "edges": eco_edges,
        "keystones": eco_keystone_list,
        "species_count": len(eco_nodes),
        "edge_count": len(eco_edges),
    }
    print(f"  {eco_name}: {len(eco_nodes)} species, {len(eco_edges)} edges, {len(eco_keystone_list)} keystones")

print(f"Built {len(ecosystem_graphs)} ecosystem graphs")


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


# ─── Write Outputs ───

# 1. Main App Data (Heavy datasets moved to JSON for latency/bundle size)
app_data = {
    "zones": zone_summaries,
    "nodes": dependency_nodes,
    "edges": dependency_edges,
    "keystone_rankings": keystone_rankings,
    "zone_keystone_rankings": zone_keystone_rankings,
    "collapse_predictions": collapse_predictions,
    "ecosystem_index": {name: {"description": eg["description"], "keywords": eg["keywords"], "zone_count": eg["zone_count"], "species_count": eg["species_count"], "edge_count": eg["edge_count"], "keystones": [{"common_name": k["common_name"], "zone_keystone_score": k["zone_keystone_score"]} for k in eg["keystones"]], "zones": eg["zones"]} for name, eg in ecosystem_graphs.items()},
    "global_stats": {
        "totalSpecies": total_species,
        "totalObservations": total_obs,
        "totalZones": len(zone_summaries),
        "zonesAtRisk": len(collapse_predictions),
        "trophicBreakdown": dict(global_trophic),
        "healthDistribution": dict(Counter(z["health"]["grade"] for z in zone_summaries)),
        "ecosystemCount": len(ecosystem_graphs),
    }
}

os.makedirs("frontend/public/data", exist_ok=True)
with open("frontend/public/data/app-data.json", "w") as f:
    json.dump(app_data, f)
print("Wrote frontend/public/data/app-data.json")

with open("frontend/public/data/zone-graphs.json", "w") as f:
    json.dump(zone_dependency_graphs, f)
print("Wrote frontend/public/data/zone-graphs.json")

with open("frontend/public/data/ecosystem-graphs.json", "w") as f:
    json.dump(ecosystem_graphs, f)
print("Wrote frontend/public/data/ecosystem-graphs.json")

# 2. Lightweight TypeScript Bridge (Only types and tiny constants)
ts_output = f'''// Auto-generated types and metadata from {INPUT_DIR}
// Source data is fetched from /data/app-data.json to keep bundle size small.

import ecosystemData from "./ecosystemIndex.json";

export const APP_DATA_URL = "/data/app-data.json";

export interface ZoneNode {{
  id: string;
  common_name: string;
  trophic_level: string;
  observations: number;
  decline_trend: number;
  keystone_score: number;
  zone_keystone_score: number;
}}

export interface DependencyNode {{
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
}}

export interface DependencyEdge {{
  source: string;
  target: string;
  type: string;
  strength: number;
}}

export interface KeystoneRanking {{
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

export interface EcosystemIndex {{
  description: string;
  keywords: string[];
  zone_count: number;
  species_count: number;
  edge_count: number;
  keystones: {{ common_name: string; zone_keystone_score: number }}[];
  zones: {{ id: string; name: string; grade: string; score: number }}[];
}}

export interface GlobalStats {{
  totalSpecies: number;
  totalObservations: number;
  totalZones: number;
  zonesAtRisk: number;
  trophicBreakdown: Record<string, number>;
  healthDistribution: Record<string, number>;
  ecosystemCount: number;
}}

export interface Zone {{
  id: string;
  name: string;
  lat: number;
  lng: number;
  total_species: number;
  total_observations: number;
  health: {{
    grade: string;
    score: number;
    risks: {{ type: string; message: string }}[];
    trophic_completeness: number;
    trend_pct: number;
  }};
  trophic: Record<string, {{ count: number; species: string[] }}>;
  yearly_species: Record<string, number>;
  top_families: Record<string, number>;
}}

export interface EcosystemGraph {{
  description: string;
  keywords: string[];
  zone_count: number;
  species_count: number;
  edge_count: number;
  keystones: ZoneKeystoneEntry[];
  zones: {{ id: string; name: string; grade: string; score: number }}[];
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}}

export interface CollapsePrediction {{
  zone: string;
  zone_id: string;
  grade: string;
  score: number;
  missing_levels: string[];
  at_risk_species: string[];
  risks: any[];
}}

export const ECOSYSTEM_INDEX: Record<string, EcosystemIndex> = ecosystemData.ecosystem_index as Record<string, EcosystemIndex>;
export const GLOBAL_STATS: GlobalStats = ecosystemData.global_stats as GlobalStats;
'''

with open(OUTPUT, "w") as f:
    f.write(ts_output)

print(f"Wrote {OUTPUT}")

eco_index_data = {
    "ecosystem_index": {name: {"description": eg["description"], "keywords": eg["keywords"], "zone_count": eg["zone_count"], "species_count": eg["species_count"], "edge_count": eg["edge_count"], "keystones": [{"common_name": k["common_name"], "zone_keystone_score": k["zone_keystone_score"]} for k in eg["keystones"]], "zones": eg["zones"]} for name, eg in ecosystem_graphs.items()},
    "global_stats": app_data["global_stats"],
}
with open("frontend/src/lib/ecosystemIndex.json", "w") as f:
    json.dump(eco_index_data, f, indent=2)
print("Wrote frontend/src/lib/ecosystemIndex.json")


# ─── Write Additional Outputs ───

# 1. Normalized JSON for Frontend (Lightweight)
frontend_stats = {
    "global_stats": {
        "totalSpecies": total_species,
        "totalObservations": total_obs,
        "totalZones": len(zone_summaries),
        "zonesAtRisk": len(collapse_predictions),
        "trophicBreakdown": dict(global_trophic),
        "healthDistribution": dict(Counter(z["health"]["grade"] for z in zone_summaries)),
        "ecosystemCount": len(ecosystem_graphs),
    },
    "zones": [{
        "id": z["id"],
        "name": z["name"],
        "lat": z["lat"],
        "lng": z["lng"],
        "health": z["health"],
        "trophic": z["trophic"],
        "total_species": z["total_species"],
        "total_observations": z["total_observations"],
        "yearly_species": z["yearly_species"],
    } for z in zone_summaries],
    "collapse_predictions": collapse_predictions
}

import os
os.makedirs("data/snowflake", exist_ok=True)

with open("frontend/src/lib/siteMetadata.json", "w") as f:
    json.dump(frontend_stats, f, indent=2)

with open("frontend/public/data/site-metadata.json", "w") as f:
    json.dump(frontend_stats, f, indent=2)

# 2. Master Species Map (for hydration)
master_species = { sid: {
    "id": sid,
    "common_name": sp["common_name"],
    "trophic_level": sp["trophic_level"],
    "trophic_label": sp["trophic_label"],
    "iconic_taxon": sp["iconic_taxon"],
    "order": sp["order"],
    "family": sp["family"],
} for sid, sp in all_species.items() }

with open("frontend/src/lib/masterSpecies.json", "w") as f:
    json.dump(master_species, f, indent=2)

# 3. Dependency Graph Data (for CascadeGraph)
graph_data = {
    "nodes": dependency_nodes,
    "edges": dependency_edges,
    "zone_graphs": zone_dependency_graphs,
    "keystone_rankings": keystone_rankings,
    "zone_keystone_rankings": zone_keystone_rankings
}
with open("frontend/src/lib/graphData.json", "w") as f:
    json.dump(graph_data, f, indent=2)

# 4. CSVs for Snowflake Integration
def write_csv(filename, fieldnames, data):
    with open(f"data/snowflake/{filename}", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

# regional_biodiversity.csv
write_csv("regional_biodiversity.csv", 
          ["region", "total_observations", "unique_species", "shannon_index", "biodiversity_score"],
          [{"region": z["name"], 
            "total_observations": z["total_observations"],
            "unique_species": z["total_species"],
            "shannon_index": z["health"].get("shannon_index", 0),
            "biodiversity_score": z["health"]["score"]} for z in zone_summaries])

# temporal_trends.csv
trends_data = []
for z in zone_summaries:
    for year, count in z["yearly_species"].items():
        trends_data.append({
            "region": z["name"],
            "year": int(year),
            "year_month": f"{year}-01",
            "unique_species": count,
            "observation_count": count # Proxy for sample size in this context
        })
write_csv("temporal_trends.csv", 
          ["region", "year", "year_month", "unique_species", "observation_count"],
          trends_data)

# species_dependencies.csv (for the cascade graph logic)
deps_data = []
for edge in dependency_edges:
    deps_data.append({
        "source": edge["source"],
        "target": edge["target"],
        "relationship_type": edge["type"],
        "strength": edge["strength"]
    })
write_csv("species_dependencies.csv", 
          ["source", "target", "relationship_type", "strength"],
          deps_data)

print(f"\nOptimization Complete:")
print(f"  - Frontend Metadata: frontend/src/lib/siteMetadata.json")
print(f"  - Master Species: frontend/src/lib/masterSpecies.json")
print(f"  - Snowflake CSVs: data/snowflake/*.csv")

