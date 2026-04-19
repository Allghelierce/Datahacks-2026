import requests
import json
import time

API = "https://api.inaturalist.org/v1/observations"

SD_NEIGHBORHOODS = {
    "La Jolla": {"lat": 32.8328, "lng": -117.2713},
    "Balboa Park": {"lat": 32.7341, "lng": -117.1446},
    "Mission Bay": {"lat": 32.7872, "lng": -117.2350},
    "Torrey Pines": {"lat": 32.9200, "lng": -117.2530},
    "Point Loma": {"lat": 32.6734, "lng": -117.2425},
    "Miramar": {"lat": 32.8831, "lng": -117.1448},
    "Rancho Bernardo": {"lat": 33.0174, "lng": -117.0754},
    "Otay Mountain": {"lat": 32.6088, "lng": -116.8330},
    "Mission Trails": {"lat": 32.8378, "lng": -117.0310},
    "Penasquitos": {"lat": 32.9340, "lng": -117.1710},
    "Scripps Ranch": {"lat": 32.9020, "lng": -117.1030},
    "Del Mar": {"lat": 32.9595, "lng": -117.2653},
    "Encinitas": {"lat": 33.0369, "lng": -117.2919},
    "Carlsbad": {"lat": 33.1581, "lng": -117.3506},
    "Oceanside": {"lat": 33.1959, "lng": -117.3795},
}

RADIUS_KM = 5

all_data = {}

for name, coords in SD_NEIGHBORHOODS.items():
    print(f"Fetching {name}...")
    observations = []

    for page in range(1, 6):
        params = {
            "lat": coords["lat"],
            "lng": coords["lng"],
            "radius": RADIUS_KM,
            "quality_grade": "research",
            "per_page": 200,
            "page": page,
            "order_by": "observed_on",
            "d1": "2020-01-01",
            "fields": "id,taxon,observed_on,location,place_guess",
        }

        try:
            resp = requests.get(API, params=params, timeout=30)
            if resp.status_code != 200:
                print(f"  Error {resp.status_code} on page {page}")
                break
            results = resp.json().get("results", [])
            if not results:
                break

            for obs in results:
                taxon = obs.get("taxon") or {}
                location = obs.get("location")
                if not taxon.get("name") or not location:
                    continue

                lat, lng = None, None
                if isinstance(location, str):
                    parts = location.split(",")
                    try:
                        lat, lng = float(parts[0].strip()), float(parts[1].strip())
                    except (ValueError, IndexError):
                        pass

                ancestors = taxon.get("ancestor_ids", [])
                observations.append({
                    "id": obs.get("id"),
                    "species": taxon.get("name"),
                    "common_name": taxon.get("preferred_common_name"),
                    "iconic_taxon": taxon.get("iconic_taxon_name"),
                    "taxon_id": taxon.get("id"),
                    "rank": taxon.get("rank"),
                    "observed_on": obs.get("observed_on"),
                    "lat": lat,
                    "lng": lng,
                })
        except Exception as e:
            print(f"  Exception: {e}")
            break

        time.sleep(0.5)

    all_data[name] = observations
    print(f"  Got {len(observations)} observations")
    time.sleep(1)

with open("scripts/sd_observations.json", "w") as f:
    json.dump(all_data, f, indent=2)

print(f"\nDone! Total observations: {sum(len(v) for v in all_data.values())}")

summary = {}
for name, obs in all_data.items():
    taxa = {}
    species_set = set()
    for o in obs:
        iconic = o.get("iconic_taxon") or "Unknown"
        taxa[iconic] = taxa.get(iconic, 0) + 1
        species_set.add(o["species"])
    summary[name] = {
        "total_observations": len(obs),
        "unique_species": len(species_set),
        "taxa_breakdown": taxa,
    }

with open("scripts/sd_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

print("\nSummary:")
for name, s in sorted(summary.items(), key=lambda x: -x[1]["unique_species"]):
    print(f"  {name}: {s['unique_species']} species, {s['total_observations']} obs")
    for taxon, count in sorted(s["taxa_breakdown"].items(), key=lambda x: -x[1]):
        print(f"    {taxon}: {count}")
