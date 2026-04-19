# Databricks notebook — Notebook 2
# Builds food web, zone health scores, and collapse predictions.
# Designed for Databricks Serverless — uses spark.sql() instead of DataFrame API.

# ============================================================
# STEP 1: Classify trophic levels
# ============================================================

spark.sql("DROP TABLE IF EXISTS bioscope.classified_observations")
spark.sql("""
    CREATE TABLE bioscope.classified_observations AS
    SELECT *,
        CASE
            WHEN iconic_taxon IN ('Plantae', 'Chromista') THEN 'producer'
            WHEN iconic_taxon = 'Fungi' THEN 'decomposer'
            WHEN iconic_taxon = 'Insecta' AND taxon_order IN ('Lepidoptera', 'Hymenoptera', 'Coleoptera', 'Diptera') THEN 'pollinator'
            WHEN iconic_taxon = 'Insecta' THEN 'primary_consumer'
            WHEN iconic_taxon = 'Arachnida' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Mollusca' THEN 'primary_consumer'
            WHEN iconic_taxon = 'Aves' AND taxon_order IN ('Accipitriformes', 'Falconiformes', 'Strigiformes') THEN 'apex_predator'
            WHEN iconic_taxon = 'Aves' AND taxon_order IN ('Pelecaniformes', 'Suliformes', 'Charadriiformes', 'Podicipediformes', 'Anseriformes', 'Gruiformes') THEN 'tertiary_consumer'
            WHEN iconic_taxon = 'Aves' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Mammalia' AND taxon_order IN ('Carnivora') THEN 'apex_predator'
            WHEN iconic_taxon = 'Mammalia' AND taxon_order IN ('Rodentia', 'Lagomorpha') THEN 'primary_consumer'
            WHEN iconic_taxon = 'Mammalia' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Reptilia' AND taxon_order = 'Squamata' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Reptilia' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Amphibia' THEN 'secondary_consumer'
            WHEN iconic_taxon = 'Actinopterygii' THEN 'secondary_consumer'
            ELSE 'primary_consumer'
        END AS trophic_level
    FROM bioscope.raw_observations
""")

result = spark.sql("""
    SELECT trophic_level, COUNT(DISTINCT species_name) as species, COUNT(*) as observations
    FROM bioscope.classified_observations
    GROUP BY trophic_level
    ORDER BY observations DESC
""")
display(result)

# ============================================================
# STEP 2: Species profiles (dependency graph nodes)
# ============================================================

spark.sql("DROP TABLE IF EXISTS bioscope.species_profiles")
spark.sql("""
    CREATE TABLE bioscope.species_profiles AS
    SELECT
        species_name,
        FIRST(common_name) as common_name,
        FIRST(trophic_level) as trophic_level,
        FIRST(iconic_taxon) as iconic_taxon,
        FIRST(taxon_order) as taxon_order,
        FIRST(taxon_family) as taxon_family,
        COUNT(*) as observations,
        COUNT(DISTINCT zone_id) as zone_count
    FROM bioscope.classified_observations
    GROUP BY species_name
    ORDER BY observations DESC
""")

display(spark.sql("SELECT * FROM bioscope.species_profiles LIMIT 20"))

# ============================================================
# STEP 3: Food web edges (dependency graph)
# Edges connect species across trophic levels that co-occur in zones.
# Strength = shared zones / max shared zones (normalized 0-1).
# ============================================================

spark.sql("DROP TABLE IF EXISTS bioscope.food_web_edges")
spark.sql("""
    CREATE TABLE bioscope.food_web_edges AS
    WITH species_zones AS (
        SELECT DISTINCT species_name, trophic_level, zone_id
        FROM bioscope.classified_observations
    ),
    trophic_pairs(source_level, target_level, edge_type) AS (
        VALUES
            ('producer', 'primary_consumer', 'food source'),
            ('producer', 'pollinator', 'pollination'),
            ('primary_consumer', 'secondary_consumer', 'prey'),
            ('pollinator', 'secondary_consumer', 'prey'),
            ('secondary_consumer', 'tertiary_consumer', 'prey'),
            ('tertiary_consumer', 'apex_predator', 'prey'),
            ('producer', 'decomposer', 'decomposition')
    ),
    co_occurrence AS (
        SELECT
            s.species_name as source,
            t.species_name as target,
            tp.edge_type as type,
            COUNT(DISTINCT s.zone_id) as shared_zones
        FROM species_zones s
        JOIN species_zones t ON s.zone_id = t.zone_id
        JOIN trophic_pairs tp ON s.trophic_level = tp.source_level AND t.trophic_level = tp.target_level
        WHERE s.species_name != t.species_name
        GROUP BY s.species_name, t.species_name, tp.edge_type
    ),
    max_zones AS (
        SELECT MAX(shared_zones) as max_sz FROM co_occurrence
    )
    SELECT
        source,
        target,
        type,
        ROUND(shared_zones / max_sz, 2) as strength
    FROM co_occurrence, max_zones
    WHERE shared_zones / max_sz >= 0.3
""")

display(spark.sql("SELECT type, COUNT(*) as edges, ROUND(AVG(strength), 2) as avg_strength FROM bioscope.food_web_edges GROUP BY type ORDER BY edges DESC"))

# ============================================================
# STEP 4: Zone health scores
# ============================================================

spark.sql("DROP TABLE IF EXISTS bioscope.zone_health")
spark.sql("""
    CREATE TABLE bioscope.zone_health AS
    WITH zone_species AS (
        SELECT
            zone_id,
            FIRST(zone_name) as zone_name,
            COUNT(DISTINCT species_name) as total_species,
            COUNT(*) as total_observations
        FROM bioscope.classified_observations
        GROUP BY zone_id
    ),
    zone_trophic AS (
        SELECT
            zone_id,
            COUNT(DISTINCT CASE WHEN trophic_level = 'producer' THEN species_name END) as producer,
            COUNT(DISTINCT CASE WHEN trophic_level = 'pollinator' THEN species_name END) as pollinator,
            COUNT(DISTINCT CASE WHEN trophic_level = 'primary_consumer' THEN species_name END) as primary_consumer,
            COUNT(DISTINCT CASE WHEN trophic_level = 'secondary_consumer' THEN species_name END) as secondary_consumer,
            COUNT(DISTINCT CASE WHEN trophic_level = 'tertiary_consumer' THEN species_name END) as tertiary_consumer,
            COUNT(DISTINCT CASE WHEN trophic_level = 'apex_predator' THEN species_name END) as apex_predator,
            COUNT(DISTINCT CASE WHEN trophic_level = 'decomposer' THEN species_name END) as decomposer
        FROM bioscope.classified_observations
        GROUP BY zone_id
    ),
    scored AS (
        SELECT
            zs.zone_id,
            zs.zone_name,
            zs.total_species,
            zs.total_observations,
            zt.producer, zt.pollinator, zt.primary_consumer, zt.secondary_consumer,
            zt.tertiary_consumer, zt.apex_predator, zt.decomposer,
            ROUND(
                (
                    (CASE WHEN zt.producer > 0 THEN 1 ELSE 0 END) +
                    (CASE WHEN zt.pollinator > 0 THEN 1 ELSE 0 END) +
                    (CASE WHEN zt.primary_consumer > 0 THEN 1 ELSE 0 END) +
                    (CASE WHEN zt.secondary_consumer > 0 THEN 1 ELSE 0 END) +
                    (CASE WHEN zt.tertiary_consumer > 0 THEN 1 ELSE 0 END) +
                    (CASE WHEN zt.apex_predator > 0 THEN 1 ELSE 0 END)
                ) / 6.0 * 100,
                1
            ) as trophic_completeness
        FROM zone_species zs
        JOIN zone_trophic zt ON zs.zone_id = zt.zone_id
    )
    SELECT *,
        ROUND(
            trophic_completeness * 0.4
            + LEAST(LN(total_species + 1) / LN(200) * 100, 100) * 0.3
            + trophic_completeness * 0.3,
            1
        ) as health_score,
        CASE
            WHEN trophic_completeness * 0.4 + LEAST(LN(total_species + 1) / LN(200) * 100, 100) * 0.3 + trophic_completeness * 0.3 >= 80 THEN 'A'
            WHEN trophic_completeness * 0.4 + LEAST(LN(total_species + 1) / LN(200) * 100, 100) * 0.3 + trophic_completeness * 0.3 >= 60 THEN 'B'
            WHEN trophic_completeness * 0.4 + LEAST(LN(total_species + 1) / LN(200) * 100, 100) * 0.3 + trophic_completeness * 0.3 >= 40 THEN 'C'
            WHEN trophic_completeness * 0.4 + LEAST(LN(total_species + 1) / LN(200) * 100, 100) * 0.3 + trophic_completeness * 0.3 >= 25 THEN 'D'
            ELSE 'F'
        END as grade
    FROM scored
""")

display(spark.sql("SELECT zone_id, zone_name, total_species, health_score, grade FROM bioscope.zone_health ORDER BY health_score DESC"))

# ============================================================
# STEP 5: Yearly species per zone (for trend analysis)
# ============================================================

spark.sql("DROP TABLE IF EXISTS bioscope.zone_yearly_species")
spark.sql("""
    CREATE TABLE bioscope.zone_yearly_species AS
    SELECT
        zone_id,
        YEAR(TO_DATE(observed_on)) as year,
        COUNT(DISTINCT species_name) as yearly_unique,
        COUNT(*) as yearly_observations
    FROM bioscope.classified_observations
    WHERE observed_on IS NOT NULL
    GROUP BY zone_id, YEAR(TO_DATE(observed_on))
    ORDER BY zone_id, year
""")

display(spark.sql("SELECT * FROM bioscope.zone_yearly_species LIMIT 20"))

# ============================================================
# SUMMARY
# ============================================================

print("=== Pipeline complete! ===")
display(spark.sql("SELECT 'Species' as metric, COUNT(DISTINCT species_name) as value FROM bioscope.classified_observations UNION ALL SELECT 'Observations', COUNT(*) FROM bioscope.classified_observations UNION ALL SELECT 'Zones', COUNT(DISTINCT zone_id) FROM bioscope.classified_observations UNION ALL SELECT 'Food Web Edges', COUNT(*) FROM bioscope.food_web_edges"))
