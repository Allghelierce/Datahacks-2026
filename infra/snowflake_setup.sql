-- Snowflake setup: run these in Snowflake console

CREATE DATABASE IF NOT EXISTS BIOSCOPE;
USE DATABASE BIOSCOPE;
CREATE SCHEMA IF NOT EXISTS PUBLIC;

-- External stage pointing to S3
CREATE OR REPLACE STAGE bioscope_s3_stage
  URL = 's3://bioscope-data/processed/'
  CREDENTIALS = (AWS_KEY_ID='...' AWS_SECRET_KEY='...')
  FILE_FORMAT = (TYPE = 'PARQUET');

-- Regional biodiversity table
CREATE OR REPLACE TABLE regional_biodiversity (
  region VARCHAR,
  total_observations INT,
  unique_species INT,
  shannon_index FLOAT,
  biodiversity_score FLOAT
);

COPY INTO regional_biodiversity
FROM @bioscope_s3_stage/regional_biodiversity/
FILE_FORMAT = (TYPE = 'PARQUET')
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;

-- Temporal trends table
CREATE OR REPLACE TABLE temporal_trends (
  region VARCHAR,
  year INT,
  month INT,
  year_month VARCHAR,
  unique_species INT,
  observation_count INT
);

COPY INTO temporal_trends
FROM @bioscope_s3_stage/temporal_trends/
FILE_FORMAT = (TYPE = 'PARQUET')
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;

-- Useful views for the API

-- Top declining regions (comparing first vs last year)
CREATE OR REPLACE VIEW declining_regions AS
WITH yearly AS (
  SELECT region, year, SUM(unique_species) as yearly_species
  FROM temporal_trends
  GROUP BY region, year
),
first_last AS (
  SELECT region,
    MAX(CASE WHEN year = (SELECT MIN(year) FROM yearly) THEN yearly_species END) as first_year_species,
    MAX(CASE WHEN year = (SELECT MAX(year) FROM yearly) THEN yearly_species END) as last_year_species
  FROM yearly
  GROUP BY region
)
SELECT region,
  first_year_species,
  last_year_species,
  last_year_species - first_year_species as species_change,
  ROUND((last_year_species - first_year_species)::FLOAT / NULLIF(first_year_species, 0) * 100, 2) as pct_change
FROM first_last
ORDER BY pct_change ASC;

-- Monthly trend summary
CREATE OR REPLACE VIEW monthly_trends AS
SELECT year_month,
  SUM(unique_species) as total_unique_species,
  SUM(observation_count) as total_observations,
  COUNT(DISTINCT region) as regions_reporting
FROM temporal_trends
GROUP BY year_month
ORDER BY year_month;

-- Region rankings
CREATE OR REPLACE VIEW region_rankings AS
SELECT region, biodiversity_score, unique_species, total_observations,
  RANK() OVER (ORDER BY biodiversity_score DESC) as rank
FROM regional_biodiversity
ORDER BY rank;
