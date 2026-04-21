# BioScope

**Biodiversity intelligence for San Diego County.**

BioScope identifies which species your ecosystem can't afford to lose — and which ones are already disappearing. Enter any neighborhood, park, or trail and we simulate species removal across the food web, flag declining species, and generate AI conservation reports.

Built at DataHacks 2026 (UCSD, April 18–19).

---

## What It Does

- **Cascade simulation** — remove one species, see how many others collapse
- **Keystone identification** — score every species by ecosystem impact
- **Decline-linked risk flagging** — cross-reference observation trends with food web position
- **Zone-aware food web graphs** — d3-force visualization with trophic layers
- **AI conservation reports** — Gemini 2.0 Flash generates actionable, structured reports per ecosystem
- **Location search** — type any SD neighborhood or park, Gemini maps it to the right ecosystem

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion, D3.js, Leaflet, Recharts |
| Backend | AWS Lambda, API Gateway, Next.js API Routes |
| Data Warehouse | Snowflake (Cortex AI — Mistral Large) |
| Storage | Amazon S3 |
| AI | Google Gemini 2.0 Flash |
| Data Sources | iNaturalist API, GloBI API |
| Data Pipeline | Spark SQL, Python |

---

## Data

- 77,000 iNaturalist observations across San Diego County
- 60 threatened species tracked across 49 zones
- 8 ecosystem types with trophic food web graphs
- Real species interactions from GloBI, synthetic fallback via trophic chain rules

---

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local  # add your API keys
npm run dev
