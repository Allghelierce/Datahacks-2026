# Databricks notebook — Notebook 1
# Fetches threatened species observations from iNaturalist for San Diego County.
# Designed for Databricks Serverless (no SparkSession needed).

import requests
import time

INATURALIST_API = "https://api.inaturalist.org/v1/observations"

# San Diego County bounding box — 7x7 grid of ecological zones
LAT_MIN, LAT_MAX = 32.53, 33.22
LNG_MIN, LNG_MAX = -117.60, -116.08
GRID_ROWS, GRID_COLS = 7, 7

ZONE_NAMES = {
    "0-0": "Border Field", "0-1": "Otay Mesa", "0-2": "Jamul", "0-3": "Pine Valley",
    "0-4": "Campo", "0-5": "Jacumba", "0-6": "Mountain Empire",
    "1-0": "Imperial Beach", "1-1": "Chula Vista", "1-2": "Sweetwater", "1-3": "Alpine",
    "1-4": "Descanso", "1-5": "Mount Laguna", "1-6": "Anza-Borrego South",
    "2-0": "Coronado", "2-1": "National City", "2-2": "La Mesa", "2-3": "El Cajon",
    "2-4": "Cuyamaca", "2-5": "Julian", "2-6": "Anza-Borrego Central",
    "3-0": "Point Loma", "3-1": "Downtown SD", "3-2": "Mission Valley", "3-3": "Santee",
    "3-4": "Ramona", "3-5": "Santa Ysabel", "3-6": "Borrego Springs",
    "4-0": "Ocean Beach", "4-1": "Kearny Mesa", "4-2": "Miramar", "4-3": "Poway",
    "4-4": "San Pasqual", "4-5": "Palomar Mountain", "4-6": "Anza-Borrego North",
    "5-0": "La Jolla", "5-1": "University City", "5-2": "Scripps Ranch", "5-3": "San Marcos",
    "5-4": "Escondido", "5-5": "Valley Center", "5-6": "Pauma Valley",
    "6-0": "Del Mar", "6-1": "Solana Beach", "6-2": "Rancho Santa Fe", "6-3": "Vista",
    "6-4": "Fallbrook", "6-5": "Temecula", "6-6": "Aguanga",
}

SD_PLACE_ID = 29
CONSERVATION_STATUSES = ["CR", "EN", "VU", "NT"]


def lat_lng_to_zone(lat, lng):
    if lat is None or lng is None:
        return None
    if lat < LAT_MIN or lat > LAT_MAX or lng < LNG_MIN or lng > LNG_MAX:
        return None
    row = min(int((lat - LAT_MIN) / ((LAT_MAX - LAT_MIN) / GRID_ROWS)), GRID_ROWS - 1)
    col = min(int((lng - LNG_MIN) / ((LNG_MAX - LNG_MIN) / GRID_COLS)), GRID_COLS - 1)
    return f"{row}-{col}"


def fetch_sd_observations(per_page=200, max_pages=50):
    all_obs = []
    for cs in CONSERVATION_STATUSES:
        page = 1
        while page <= max_pages:
            params = {
                "place_id": SD_PLACE_ID,
                "quality_grade": "research",
                "per_page": per_page,
                "page": page,
                "order_by": "observed_on",
                "cs": cs,
                "d1": "2020-01-01",
            }
            try:
                resp = requests.get(INATURALIST_API, params=params, timeout=30)
            except requests.RequestException as e:
                print(f"  Request error page {page}: {e}")
                break

            if resp.status_code == 429:
                print("  Rate limited, waiting 10s...")
                time.sleep(10)
                continue
            if resp.status_code != 200:
                print(f"  Error page {page}: {resp.status_code}")
                break

            data = resp.json()
            results = data.get("results", [])
            if not results:
                break

            for obs in results:
                taxon = obs.get("taxon") or {}
                location = obs.get("location")
                lat, lng = None, None
                if location:
                    try:
                        parts = location.split(",")
                        lat, lng = float(parts[0].strip()), float(parts[1].strip())
                    except (ValueError, IndexError):
                        lat, lng = None, None

                zone_id = lat_lng_to_zone(lat, lng)

                all_obs.append((
                    obs.get("id"),
                    taxon.get("name"),
                    taxon.get("preferred_common_name"),
                    taxon.get("iconic_taxon_name"),
                    taxon.get("order"),
                    taxon.get("family"),
                    obs.get("observed_on"),
                    lat,
                    lng,
                    zone_id,
                    ZONE_NAMES.get(zone_id, "Unknown") if zone_id else None,
                    cs,
                ))

            print(f"  [{cs}] page {page}: {len(results)} obs (total: {len(all_obs)})")
            page += 1
            time.sleep(1)

    return all_obs


# --- Main execution ---
print("Fetching San Diego County threatened species observations...")
observations = fetch_sd_observations()
print(f"\nTotal observations fetched: {len(observations)}")

# --- Store in Databricks SQL table ---
spark.sql("CREATE DATABASE IF NOT EXISTS bioscope")

spark.sql("DROP TABLE IF EXISTS bioscope.raw_observations")
spark.sql("""
    CREATE TABLE bioscope.raw_observations (
        observation_id BIGINT,
        species_name STRING,
        common_name STRING,
        iconic_taxon STRING,
        taxon_order STRING,
        taxon_family STRING,
        observed_on STRING,
        latitude DOUBLE,
        longitude DOUBLE,
        zone_id STRING,
        zone_name STRING,
        conservation_status STRING
    )
""")

# Insert in batches
BATCH_SIZE = 500
valid_obs = [o for o in observations if o[1] is not None and o[9] is not None]

for i in range(0, len(valid_obs), BATCH_SIZE):
    batch = valid_obs[i:i + BATCH_SIZE]
    values = []
    for row in batch:
        def esc(v):
            if v is None:
                return "NULL"
            if isinstance(v, (int, float)):
                return str(v)
            return "'" + str(v).replace("'", "''") + "'"
        values.append(f"({', '.join(esc(v) for v in row)})")
    spark.sql(f"INSERT INTO bioscope.raw_observations VALUES {', '.join(values)}")

result = spark.sql("SELECT COUNT(*) as cnt, COUNT(DISTINCT species_name) as species, COUNT(DISTINCT zone_id) as zones FROM bioscope.raw_observations")
display(result)
print("Done! Data saved to bioscope.raw_observations")
