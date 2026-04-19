# Response Style
- Keep responses to 1-2 short sentences. No narration of what you're doing or what you did.
- Just do the work and give brief status updates.

# BioScope — DataHacks 2026

**Event:** DataHacks 2026, UCSD Rec Gym, April 18-19 (36 hours)
**Team:** 4 people, vibecoding approach
**One-liner:** "BioScope identifies which species your ecosystem can't afford to lose — and which ones are already disappearing."

## What It Does
Biodiversity intelligence platform for San Diego County. Transforms iNaturalist citizen science data into keystone species identification, ecosystem risk assessment, and conservation priority reports.

Core features: cascade removal simulation, decline-linked risk flagging, zone-aware food web analysis, AI conservation reports (Gemini + Snowflake Cortex).

## Challenges
1. **Best Use of [X] Data** (~$1500) — PRIMARY. Novel derived intelligence from citizen science data.
2. **Best Innovation w/ Google Build With AI** — PRIMARY. Gemini generates zone-specific conservation reports from structured cascade + decline data.
3. **Best Use of Gemini API (MLH)** — BONUS. Same Gemini integration.
4. **Best Use of Snowflake** — Cortex AI for in-warehouse ecological analysis + analytical views.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind, d3-force, framer-motion
- **Data:** iNaturalist API → Databricks → S3 → Snowflake (Cortex AI)
- **Backend:** AWS Lambda + API Gateway
- **AI:** Gemini 2.0 Flash + Snowflake Cortex
- **Deploy:** DigitalOcean App Platform (Vercel as backup)

## Snowflake
- Account: otipiuk-tmb54945
- Database: BIOSCOPE, table: threatened_species (77K rows)
- Views: zone_biodiversity, species_rankings, yearly_trends, taxonomic_breakdown
- Cortex AI confirmed working (mistral-7b, mistral-large)
- Custom function: `analyze_species(name)` for AI ecological assessments

## Key Data
- 60 threatened species tracked across 49 zones in San Diego County
- 77K iNaturalist observations loaded in Snowflake
- Species photos from iNaturalist in `speciesPhotos.ts`
- Ecosystem index with 8 ecosystem types, keyword search, Gemini-powered location matching

## Graph Data Pipeline (`scripts/process_data.py`)
- All 60 threatened species categorized by trophic level based on taxon class
- Global pool: up to 250 species, min 5 per trophic level, rest filled by observation count
- Per ecosystem: intersects global pool with species observed in that ecosystem's zones, caps at 150 per ecosystem (5 per trophic level guaranteed, rest by observation count)
- Edges built via trophic chain rules (producers→consumers→predators), not random
- Keystone scores computed via cascade removal simulation (how many species collapse if removed)

## Judge Talking Points
- **Data challenge:** "We derived new intelligence — cascade impact algorithm simulates species removal and measures ecosystem collapse."
- **Gemini challenge:** "Structured data injection, not generic summaries. Keystone scores, cascade impacts, decline trends → actionable recommendations."
- **Snowflake challenge:** "Cortex AI runs ecological analysis inside the warehouse — no external API needed. 77K observations with analytical views."

## Env Vars
```
NEXT_PUBLIC_GEMINI_API_KEY, SNOWFLAKE_ACCOUNT=otipiuk-tmb54945, SNOWFLAKE_DATABASE=BIOSCOPE, GEMINI_API_KEY, AWS creds, NEXT_PUBLIC_API_URL
```

## Fallbacks
- Snowflake down → Lambda reads S3 directly
- Lambda flaky → Flask/FastAPI on DigitalOcean
- DigitalOcean fails → Deploy on Vercel
- Live demo crashes → Pre-recorded screen recording
