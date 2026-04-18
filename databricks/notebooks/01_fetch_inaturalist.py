# Databricks notebook — Run in Databricks workspace
# Fetches iNaturalist observations and stores as Spark DataFrame

import requests
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType, DateType
from datetime import datetime, timedelta

INATURALIST_API = "https://api.inaturalist.org/v1/observations"

REGIONS = [
    "California", "Oregon", "Washington", "Nevada", "Arizona",
    "Colorado", "Utah", "New Mexico", "Texas", "Florida"
]

def fetch_observations(place_name: str, per_page: int = 200, pages: int = 5):
    """Fetch research-grade observations from iNaturalist for a given place."""
    all_obs = []
    for page in range(1, pages + 1):
        params = {
            "place_guess": place_name,
            "quality_grade": "research",
            "per_page": per_page,
            "page": page,
            "order_by": "observed_on",
            "d1": (datetime.now() - timedelta(days=5*365)).strftime("%Y-%m-%d"),
        }
        resp = requests.get(INATURALIST_API, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"Error fetching {place_name} page {page}: {resp.status_code}")
            continue
        results = resp.json().get("results", [])
        if not results:
            break
        for obs in results:
            taxon = obs.get("taxon") or {}
            location = obs.get("location")
            lat, lng = (None, None)
            if location:
                parts = location.split(",")
                lat, lng = float(parts[0]), float(parts[1])
            all_obs.append({
                "observation_id": obs.get("id"),
                "species_name": taxon.get("name"),
                "common_name": taxon.get("preferred_common_name"),
                "iconic_taxon": taxon.get("iconic_taxon_name"),
                "observed_on": obs.get("observed_on"),
                "latitude": lat,
                "longitude": lng,
                "place_guess": obs.get("place_guess"),
                "region": place_name,
                "quality_grade": obs.get("quality_grade"),
            })
    return all_obs

# --- Main execution ---
all_observations = []
for region in REGIONS:
    print(f"Fetching observations for {region}...")
    obs = fetch_observations(region)
    all_observations.extend(obs)
    print(f"  Got {len(obs)} observations")

print(f"\nTotal observations: {len(all_observations)}")

schema = StructType([
    StructField("observation_id", IntegerType()),
    StructField("species_name", StringType()),
    StructField("common_name", StringType()),
    StructField("iconic_taxon", StringType()),
    StructField("observed_on", StringType()),
    StructField("latitude", DoubleType()),
    StructField("longitude", DoubleType()),
    StructField("place_guess", StringType()),
    StructField("region", StringType()),
    StructField("quality_grade", StringType()),
])

spark = SparkSession.builder.getOrCreate()
df = spark.createDataFrame(all_observations, schema=schema)
df.write.mode("overwrite").saveAsTable("bioscope.raw_observations")
print("Saved to bioscope.raw_observations")
