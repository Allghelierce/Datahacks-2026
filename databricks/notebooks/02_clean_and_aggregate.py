# Databricks notebook — Cleans raw data and computes biodiversity metrics

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window
import math

spark = SparkSession.builder.getOrCreate()

# --- Load raw data ---
df = spark.table("bioscope.raw_observations")

# --- Clean ---
df_clean = (
    df
    .filter(F.col("species_name").isNotNull())
    .filter(F.col("latitude").isNotNull())
    .filter(F.col("observed_on").isNotNull())
    .withColumn("observed_date", F.to_date("observed_on"))
    .withColumn("year", F.year("observed_date"))
    .withColumn("month", F.month("observed_date"))
    .withColumn("year_month", F.date_format("observed_date", "yyyy-MM"))
    .dropDuplicates(["observation_id"])
)

df_clean.write.mode("overwrite").saveAsTable("bioscope.clean_observations")

# --- Regional biodiversity scores ---
# Shannon Diversity Index: H = -sum(pi * ln(pi))
# where pi = proportion of species i in the region

species_counts = (
    df_clean
    .groupBy("region", "species_name")
    .agg(F.count("*").alias("species_count"))
)

region_totals = (
    df_clean
    .groupBy("region")
    .agg(
        F.count("*").alias("total_observations"),
        F.countDistinct("species_name").alias("unique_species"),
    )
)

species_proportions = (
    species_counts
    .join(region_totals.select("region", "total_observations"), on="region")
    .withColumn("proportion", F.col("species_count") / F.col("total_observations"))
    .withColumn("pi_ln_pi", F.col("proportion") * F.log("proportion"))
)

shannon_index = (
    species_proportions
    .groupBy("region")
    .agg((-F.sum("pi_ln_pi")).alias("shannon_index"))
)

regional_summary = (
    region_totals
    .join(shannon_index, on="region")
    .withColumn("biodiversity_score", F.round("shannon_index", 4))
    .orderBy(F.desc("biodiversity_score"))
)

regional_summary.write.mode("overwrite").saveAsTable("bioscope.regional_biodiversity")

# --- Temporal trends ---
temporal_trends = (
    df_clean
    .groupBy("region", "year", "month", "year_month")
    .agg(
        F.countDistinct("species_name").alias("unique_species"),
        F.count("*").alias("observation_count"),
    )
    .orderBy("region", "year_month")
)

temporal_trends.write.mode("overwrite").saveAsTable("bioscope.temporal_trends")

# --- Export to S3 ---
S3_BUCKET = "s3://bioscope-data"

regional_summary.coalesce(1).write.mode("overwrite").parquet(f"{S3_BUCKET}/processed/regional_biodiversity/")
temporal_trends.coalesce(1).write.mode("overwrite").parquet(f"{S3_BUCKET}/processed/temporal_trends/")
df_clean.write.mode("overwrite").parquet(f"{S3_BUCKET}/processed/clean_observations/")

print("Exported to S3!")
regional_summary.show()
