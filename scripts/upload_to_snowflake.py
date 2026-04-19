"""Upload species_metadata.csv and species_interactions.csv directly to Snowflake."""
import csv
import os

try:
    import snowflake.connector
except ImportError:
    print("Installing snowflake-connector-python...")
    os.system("pip3 install snowflake-connector-python")
    import snowflake.connector

conn = snowflake.connector.connect(
    account=os.environ.get("SNOWFLAKE_ACCOUNT", "otipiuk-tmb54945"),
    user=os.environ.get("SNOWFLAKE_USER"),
    password=os.environ.get("SNOWFLAKE_PASSWORD"),
    database="BIOSCOPE",
    schema="PUBLIC",
    warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
)

cur = conn.cursor()

# Create tables if they don't exist
print("Creating tables...", flush=True)
cur.execute("""
CREATE TABLE IF NOT EXISTS SPECIES_METADATA (
    scientific_name VARCHAR,
    common_name VARCHAR,
    trophic_level VARCHAR,
    iconic_taxon VARCHAR,
    taxon_order VARCHAR,
    family VARCHAR,
    observation_count INT,
    zone_count INT,
    decline_trend FLOAT,
    keystone_score FLOAT,
    habitat VARCHAR
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS SPECIES_INTERACTIONS (
    source_species VARCHAR,
    target_species VARCHAR,
    interaction_type VARCHAR,
    strength FLOAT,
    data_source VARCHAR
)
""")

# Clear existing data
print("Truncating tables...", flush=True)
cur.execute("TRUNCATE TABLE IF EXISTS SPECIES_METADATA")
cur.execute("TRUNCATE TABLE IF EXISTS SPECIES_INTERACTIONS")

# Upload species_metadata.csv
print("Uploading species_metadata.csv...", flush=True)
with open("data/snowflake/species_metadata.csv") as f:
    reader = csv.DictReader(f)
    batch = []
    for row in reader:
        batch.append((
            row["scientific_name"],
            row["common_name"],
            row["trophic_level"],
            row["iconic_taxon"],
            row["taxon_order"],
            row["family"],
            int(row["observation_count"]),
            int(row["zone_count"]),
            float(row["decline_trend"]),
            float(row["keystone_score"]),
            row["habitat"],
        ))
        if len(batch) >= 100:
            cur.executemany(
                "INSERT INTO SPECIES_METADATA VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                batch,
            )
            batch = []
    if batch:
        cur.executemany(
            "INSERT INTO SPECIES_METADATA VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            batch,
        )

cur.execute("SELECT COUNT(*) FROM SPECIES_METADATA")
print(f"  Loaded {cur.fetchone()[0]} species", flush=True)

# Upload species_interactions.csv
print("Uploading species_interactions.csv...", flush=True)
with open("data/snowflake/species_interactions.csv") as f:
    reader = csv.DictReader(f)
    batch = []
    for row in reader:
        batch.append((
            row["source_species"],
            row["target_species"],
            row["interaction_type"],
            float(row["strength"]),
            row["data_source"],
        ))
        if len(batch) >= 500:
            cur.executemany(
                "INSERT INTO SPECIES_INTERACTIONS VALUES (%s,%s,%s,%s,%s)",
                batch,
            )
            batch = []
    if batch:
        cur.executemany(
            "INSERT INTO SPECIES_INTERACTIONS VALUES (%s,%s,%s,%s,%s)",
            batch,
        )

cur.execute("SELECT COUNT(*) FROM SPECIES_INTERACTIONS")
print(f"  Loaded {cur.fetchone()[0]} interactions", flush=True)

cur.close()
conn.close()
print("\nDone! Data is in Snowflake.", flush=True)
