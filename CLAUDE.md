# DataHacks 2026 - BioScope: Biodiversity Intelligence Platform

## Event: DataHacks 2026, UCSD Rec Gym, April 18-19 (36 hours)
## Team: 4 people, vibecoding approach
## Track: Data Analytics (primary)
## Bonus Challenges: Best Use of [X] Data ($1500), Best Innovation w/ Google Build With AI

---

## Strategy Overview

**Project:** BioScope — a biodiversity intelligence platform that transforms iNaturalist citizen science data into keystone species identification, ecosystem risk assessment, and conservation priority reports for San Diego County.

**Why this wins:** We don't just visualize data — we derive new intelligence. Keystone species identification via cascade impact analysis, decline-linked risk flagging, and AI-generated conservation reports turn raw observations into something a conservation org would actually use.

**One-liner for judges:** "BioScope identifies which species your ecosystem can't afford to lose — and which ones are already disappearing."

**Core analytical features:**
1. **Keystone Species Identification** — Programmatic cascade removal simulation across every species, ranked by ecosystem impact percentage
2. **Decline-Linked Risk Assessment** — Cross-reference keystone scores with YoY observation trends to flag species that are both critical AND declining
3. **Zone-Aware Food Web Analysis** — Per-zone dependency graphs showing actual trophic structure, not generic models
4. **AI Conservation Reports** — Gemini generates actionable conservation narratives from structured cascade + decline data

---

## Challenges Targeted

| # | Challenge | Prize | Why We Win | Priority |
|---|-----------|-------|-----------|----------|
| 1 | **Best Use of [X] Data** | ~$1500 (DJI Drone) | Core project — keystone identification and cascade analysis are novel derived intelligence from raw citizen science data | PRIMARY |
| 2 | **Best Innovation w/ Google Build With AI** | Google Swag Duffle | Gemini generates conservation risk reports from structured cascade + decline data — not generic summaries, actionable recommendations | PRIMARY |
| 3 | Best Use of Gemini API (MLH) | Swag Kits | Overlaps #2 — same Gemini integration | BONUS |

**What to say to each challenge judge:**

| Challenge | Key talking point |
|-----------|-------------------|
| Best Use of Data | "We didn't just visualize iNaturalist data — we derived new intelligence from it. Our cascade impact algorithm identifies keystone species by simulating removal and measuring ecosystem collapse. Cross-referencing with decline trends produces conservation priority rankings that didn't exist in the raw data." |
| Google Build With AI | "Gemini generates zone-specific conservation reports using structured data: keystone scores, cascade impact percentages, decline trends, and trophic gap analysis. It produces actionable recommendations, not generic summaries — e.g., 'Monarch butterfly is a keystone pollinator declining 30% YoY in La Jolla; loss would cascade to 12 dependent species.'" |
| Gemini API (MLH) | Same as above — emphasize the structured data injection and conservation-specific prompt engineering |

---

## Cascade Rebuild — 3-Terminal Build Plan

### Terminal 1: Data Pipeline (`scripts/process_data.py`)
**Goal:** Compute keystone scores and zone-aware dependency graphs.

Changes to `process_data.py`:
- For each species in `dependency_nodes`, simulate its removal: run BFS cascade through `dependency_edges`, count how many species collapse. Store as `keystone_score` (0.0–1.0 = fraction of ecosystem lost) on each node.
- Add `decline_trend` to each node: YoY observation change from zone data.
- Build per-zone dependency subgraphs: for each zone, filter `dependency_nodes` and `dependency_edges` to species present in that zone. Store as `zone_dependency_graphs: Record<zone_id, { nodes: [...], edges: [...] }>`.
- Export new `KEYSTONE_RANKINGS` array: top species sorted by keystone_score, with fields: `id, common_name, keystone_score, decline_trend, cascade_victims: string[], zones_present: number`.
- Regenerate `frontend/src/lib/speciesData.ts` with all new fields.

**Output:** Updated `speciesData.ts` with `KEYSTONE_RANKINGS`, per-node `keystone_score`/`decline_trend`, and `ZONE_DEPENDENCY_GRAPHS`.

### Terminal 2: Cascade Visualization (`frontend/src/components/charts/CascadeGraph.tsx`)
**Goal:** Rewrite the cascade graph to be zone-aware, visually rich, and informative.

Changes to `CascadeGraph.tsx`:
- Accept optional `zone?: Zone` prop. When set, render that zone's subgraph from `ZONE_DEPENDENCY_GRAPHS[zone.id]`; when unset, render the global graph.
- Color-code edges by relationship type: green (#34d399) = food source, pink (#f472b6) = pollination, orange (#fb923c) = prey, purple (#a78bfa) = nutrient cycling.
- Use curved SVG `<path>` (quadratic bezier) instead of `<line>` for edges.
- Animated cascade: when hovering a node, propagate the red highlight with `setTimeout` delays (150ms per trophic level) so the cascade visually ripples.
- Add a side info panel (absolute positioned div) on node click showing: species name, common name, observation count, zone count, keystone score, decline trend (with red/green arrow), and cascade impact ("Removing this species collapses X% of the food web").
- Highlight keystone species (top 3 by score) with a gold ring and small crown/star icon.
- Flag declining species (negative trend) with a pulsing red outline.

**Reads from:** `ZONE_DEPENDENCY_GRAPHS`, `DEPENDENCY_NODES` (with new `keystone_score`/`decline_trend` fields), `DEPENDENCY_EDGES`.

### Terminal 3: Conservation Report (`frontend/src/components/ui/ConservationReport.tsx` + update `page.tsx`)
**Goal:** Build a conservation priority report that surfaces keystone + decline analysis.

New file `ConservationReport.tsx`:
- Import `KEYSTONE_RANKINGS` from `speciesData.ts`.
- Render a table of top 10 keystone species with columns: Rank, Species, Keystone Score (bar visual), Decline Trend (arrow + %), Cascade Impact (e.g., "14 species, 4 trophic levels"), Priority badge (Critical/High/Medium based on high keystone + negative trend).
- For species that are both high-keystone AND declining, show a red "CRITICAL PRIORITY" badge.
- Below the table, render narrative summaries: one line per critical species, e.g., "Loss of Monarch butterfly would collapse 14 species across 4 trophic levels. Currently declining 30% YoY."
- Accept optional `zone?: Zone` prop to filter to that zone's keystones.
- Style consistent with existing glass card pattern.

Update `page.tsx`:
- Import `ConservationReport`.
- Add a new section after the cascade: `<SectionHeader title="Conservation Priority Report" subtitle="Keystone species ranked by ecosystem impact and decline risk" />` followed by `<ConservationReport zone={selectedZone} />`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│                                                                  │
│  iNaturalist API ──→ [Databricks Notebooks] ──→ [AWS S3]       │
│  (public data)        • Fetch observations       • Raw parquet   │
│                       • Clean & filter            • Processed     │
│                       • Shannon Index             • Regional agg  │
│                       • Temporal aggregation                      │
│                                                                  │
│  [AWS S3] ──→ [Snowflake External Stage]                        │
│                • regional_biodiversity table                      │
│                • temporal_trends table                            │
│                • declining_regions view                           │
│                • monthly_trends view                              │
│                • region_rankings view                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      API LAYER (AWS)                             │
│                                                                  │
│  [API Gateway] ──→ [Lambda Function]                            │
│                     • GET  /regions         → all regions ranked  │
│                     • GET  /regions/:id     → detail + trends    │
│                     • GET  /trends          → global trends      │
│                     • POST /explain         → Gemini proxy       │
│                     • GET  /health          → status check       │
│                                                                  │
│  [Lambda] ──→ Snowflake (queries)                               │
│  [Lambda] ──→ Gemini API (explanations)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   FRONTEND (DigitalOcean)                        │
│                                                                  │
│  [Next.js App on DO App Platform]                               │
│   • Interactive map (react-leaflet + CircleMarkers)             │
│   • Trend charts (recharts LineChart)                           │
│   • Region detail panel with stats cards                        │
│   • "Explain This Region" button → Gemini                      │
│   • Region rankings table                                       │
│   • (Stretch) Voice narration via ElevenLabs                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Improvements Over Original Plan

1. **Databricks writes directly to S3** — eliminates a separate ETL step
2. **Snowflake reads from S3 via external stage** — no manual data loading
3. **AWS Lambda instead of EC2/containers** — zero ops, instant deploy
4. **DigitalOcean App Platform for Next.js** — git push to deploy, no Docker needed
5. **Gemini calls go through AWS Lambda** — keeps API key server-side, one integration point
6. **ElevenLabs as stretch goal** — voice narration adds "wow factor" for demos with minimal effort

---

## Team Role Split (4 people)

| Person | Role | Stack | Hours 1-12 | Hours 12-24 | Hours 24-36 |
|--------|------|-------|------------|-------------|-------------|
| P1 | Data Engineer | Python, PySpark | Databricks notebook: fetch + clean iNaturalist data | Databricks → S3 export, Snowflake setup | Polish queries, help integration |
| P2 | Backend Dev | Python, AWS | AWS account setup, S3 buckets, Lambda scaffold | API endpoints, Snowflake connector in Lambda | Integration testing, Gemini proxy endpoint |
| P3 | Frontend Dev | TypeScript, Next.js | Next.js scaffold, map component, chart components | Wire to API, region detail view | DigitalOcean deploy, UI polish |
| P4 | AI + Demo Lead | Python, Gemini API | Gemini prompt engineering, explanation endpoint | ElevenLabs stretch, demo script | Devpost submission, pitch practice, demo |

### P1 — Data Engineer Detailed Tasks
1. Sign up for Databricks Community Edition (free) or use provided workspace
2. Create cluster with Python 3.11+ and install `requests` library
3. Run `01_fetch_inaturalist.py` — fetches ~10,000 observations across 10 US states
4. Run `02_clean_and_aggregate.py` — cleans, computes Shannon Index, exports to S3
5. Verify parquet files landed in S3: `aws s3 ls s3://bioscope-data/processed/`
6. Set up Snowflake external stage and run `infra/snowflake_setup.sql`
7. Verify Snowflake views return data: `SELECT * FROM region_rankings;`

### P2 — Backend Dev Detailed Tasks
1. Create AWS account (or use existing), set up IAM user with S3 + Lambda + API Gateway permissions
2. Create S3 bucket `bioscope-data` in `us-west-2`
3. Create Lambda function with Python 3.11 runtime
4. Upload `backend/lambda_functions/handler.py` + dependencies as a zip layer
5. Create API Gateway REST API with routes mapped to Lambda
6. Enable CORS on all routes
7. Test each endpoint with curl
8. Add Gemini API key as Lambda environment variable

### P3 — Frontend Dev Detailed Tasks
1. `cd frontend && npm install && npm run dev`
2. Build out the map component with react-leaflet
3. Build trend charts with recharts
4. Build region detail panel with stats cards
5. Wire up API calls using `src/lib/api.ts`
6. Add loading states and error boundaries
7. Deploy to DigitalOcean App Platform (connect GitHub repo)
8. Test on mobile — judges may view on phones

### P4 — AI + Demo Lead Detailed Tasks
1. Get Gemini API key from Google AI Studio (https://aistudio.google.com/)
2. Test prompts in AI Studio before coding
3. Refine the explanation prompt — make output conversational, not academic
4. Write the demo script (see Pitching section below)
5. Take screenshots of every service in use for Devpost
6. (Stretch) Integrate ElevenLabs for voice narration
7. Write Devpost submission (see template below)
8. Practice 3-minute pitch at least 3 times before judging

---

## Critical Timeline

```
HOUR 0-2:    SETUP
  Everyone: Create accounts (Databricks, AWS, Snowflake, DO, Google AI Studio)
  P3: npm install, verify Next.js runs locally
  Goal: Every person can log into their platform

HOUR 2-6:    FOUNDATION
  P1: Data flowing in Databricks, first notebook working
  P2: Lambda hello-world deployed, API Gateway returning JSON
  P3: Map rendering with dummy data, chart components built
  P4: Gemini returning explanations with test data
  Goal: Every layer works independently

HOUR 6-12:   INTEGRATION PREP
  P1: Data exported to S3 as parquet, Snowflake stage created
  P2: Lambda connected to Snowflake, /regions endpoint returning real data
  P3: Frontend components complete with mock data
  P4: Prompts refined, demo outline drafted
  Goal: Backend has real data flowing, frontend is component-complete

HOUR 12-18:  INTEGRATION (CRITICAL)
  ALL: Frontend calling real API with real data from Snowflake
  P3: Wire all components to live API
  P2: Debug CORS, latency, error handling
  P4: Gemini endpoint working end-to-end
  ⚠️  CHECKPOINT: If API isn't returning real data by hour 16, execute FALLBACK PLAN

HOUR 18-24:  POLISH
  P3: Loading states, error messages, responsive design
  P2: API performance, caching headers
  P4: ElevenLabs integration (stretch)
  ALL: End-to-end testing

HOUR 24-30:  DEPLOY + TEST
  P3: Deploy to DigitalOcean App Platform
  ALL: Test deployed version on multiple devices
  P4: Screenshots of every service for Devpost
  P4: Draft Devpost submission

HOUR 30-36:  DEMO PREP
  P4: Finalize Devpost
  ALL: Practice pitch (3 min max)
  ALL: Prepare for live demo
  ALL: Backup plan if live demo fails (screenshots/video)
```

### FALLBACK PLANS

**If Snowflake doesn't work by hour 16:**
- Have Lambda read parquet directly from S3 using pandas
- Still mention Snowflake in Devpost — "we set up the stage and views but used direct S3 reads for demo reliability"

**If Lambda/API Gateway is flaky:**
- Deploy a simple Flask/FastAPI on DigitalOcean alongside the frontend
- Still count AWS for S3 usage

**If Databricks cluster is slow/down:**
- Run the Python scripts locally, upload CSVs to S3 manually
- Still show the notebook in Devpost screenshots

**If DigitalOcean deploy fails:**
- Deploy on Vercel as backup (instant Next.js deploy)
- Transfer to DO after demo if needed

**If the live demo crashes during judging:**
- Have a screen recording ready (record the full flow the night before)
- Show screenshots with annotations

---

## Tech Stack

- **Data Pipeline:** Python 3.11+, PySpark (Databricks runtime)
- **Backend:** Python 3.11+, AWS Lambda, API Gateway, boto3, snowflake-connector-python
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, react-leaflet, recharts
- **AI:** Google Gemini API (gemini-2.0-flash), ElevenLabs API (stretch)
- **Infra:** AWS S3, Snowflake, DigitalOcean App Platform
- **Data Source:** iNaturalist API (public, no auth needed for read)

---

## Data Source: iNaturalist

- **API base:** `https://api.inaturalist.org/v1/observations`
- **Auth:** None required for public observations
- **Rate limits:** ~100 requests/minute (be gentle, add delays between batches)
- **Key fields:** `taxon.name`, `taxon.preferred_common_name`, `taxon.iconic_taxon_name`, `location` (lat,lng), `observed_on`, `place_guess`, `quality_grade`
- **Filter:** `quality_grade=research` for verified observations only
- **Regions:** 10 US states: California, Oregon, Washington, Nevada, Arizona, Colorado, Utah, New Mexico, Texas, Florida
- **Time range:** Last 5 years (`d1=2021-04-18`)
- **Volume:** ~1,000 observations per state × 10 states = ~10,000 records (manageable for demo)

### Example API call
```
GET https://api.inaturalist.org/v1/observations?place_guess=California&quality_grade=research&per_page=200&page=1&order_by=observed_on&d1=2021-04-18
```

### Shannon Diversity Index
```
H = -Σ(pi × ln(pi))
```
Where `pi` = proportion of observations belonging to species `i` in a region. Higher H = more biodiversity. Typical range: 0 (one species) to 5+ (very diverse).

---

## File Structure

```
bioscope/
├── CLAUDE.md                              # This file — project strategy & reference
├── .gitignore
│
├── databricks/
│   └── notebooks/
│       ├── 01_fetch_inaturalist.py        # Fetch raw data from iNaturalist API
│       └── 02_clean_and_aggregate.py      # Clean, compute Shannon Index, export to S3
│
├── backend/
│   ├── lambda_functions/
│   │   └── handler.py                     # AWS Lambda handler — all API endpoints
│   ├── requirements.txt                   # Python deps for Lambda layer
│   └── tests/                             # (optional) endpoint tests
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── .env.local.example                 # Template for env vars
│   └── src/
│       ├── app/
│       │   ├── layout.tsx                 # Root layout with Inter font
│       │   ├── page.tsx                   # Main dashboard page
│       │   ├── globals.css                # Tailwind imports
│       │   └── region/[id]/              # (future) dedicated region pages
│       ├── components/
│       │   ├── map/
│       │   │   └── BiodiversityMap.tsx    # Leaflet map with circle markers
│       │   ├── charts/
│       │   │   └── TrendChart.tsx         # Recharts line chart
│       │   └── ui/
│       │       └── RegionDetail.tsx       # Region detail panel + Gemini explain
│       ├── lib/
│       │   └── api.ts                     # API client functions
│       └── types/
│           └── index.ts                   # TypeScript interfaces
│
├── infra/
│   └── snowflake_setup.sql               # Snowflake tables, stages, views
│
├── scripts/                               # Utility scripts
└── docs/                                  # Screenshots for Devpost
```

---

## Setup Instructions (Per Person)

### Everyone First (Hour 0)
1. Clone the repo: `git clone https://github.com/Allghelierce/Datahacks-2026.git`
2. Create a `.env` file from `.env.local.example`
3. Sign up for all platforms (see account links below)

### Account Signup Links
- **Databricks:** https://community.cloud.databricks.com/ (Community Edition, free)
- **AWS:** https://aws.amazon.com/free/ (free tier covers Lambda, S3, API Gateway)
- **Snowflake:** https://signup.snowflake.com/ (30-day free trial)
- **DigitalOcean:** https://cloud.digitalocean.com/registrations/new (GitHub student pack gives $200 credit)
- **Google AI Studio:** https://aistudio.google.com/ (free Gemini API key)
- **ElevenLabs:** https://elevenlabs.io/ (free tier gives 10,000 chars/month)

### P1 — Databricks Setup
```bash
# In Databricks workspace:
# 1. Create a new cluster (smallest size is fine)
# 2. Install library: requests (PyPI)
# 3. Import notebooks from databricks/notebooks/
# 4. Run 01_fetch_inaturalist.py first
# 5. Run 02_clean_and_aggregate.py second
# 6. Verify tables exist: spark.sql("SHOW TABLES IN bioscope").show()
```

### P2 — AWS Setup
```bash
# 1. Create S3 bucket
aws s3 mb s3://bioscope-data --region us-west-2

# 2. Create Lambda function
# - Runtime: Python 3.11
# - Handler: handler.lambda_handler
# - Timeout: 30 seconds
# - Memory: 256 MB
# - Environment variables: SNOWFLAKE_*, GEMINI_API_KEY

# 3. Create Lambda layer with dependencies
cd backend
pip install -r requirements.txt -t python/
zip -r layer.zip python/
# Upload as Lambda layer

# 4. Create API Gateway
# - REST API
# - Resources: /regions, /regions/{id}, /trends, /explain, /health
# - Methods: GET for all, POST for /explain
# - Enable CORS on all resources
# - Deploy to "prod" stage

# 5. Test
curl https://YOUR-API-ID.execute-api.us-west-2.amazonaws.com/prod/health
```

### P3 — Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with the API Gateway URL from P2
npm run dev
# Open http://localhost:3000
```

### P3 — DigitalOcean Deploy
```bash
# 1. Go to https://cloud.digitalocean.com/apps
# 2. Click "Create App"
# 3. Connect GitHub repo: Allghelierce/Datahacks-2026
# 4. Source directory: /frontend
# 5. Build command: npm run build
# 6. Run command: npm start
# 7. Add environment variable: NEXT_PUBLIC_API_URL=https://your-api-gateway-url
# 8. Deploy
```

### P2 — Snowflake Setup
```bash
# 1. Log into Snowflake web console
# 2. Open a worksheet
# 3. Paste contents of infra/snowflake_setup.sql
# 4. Replace AWS credentials in CREATE STAGE command
# 5. Run all statements
# 6. Verify: SELECT * FROM region_rankings;
```

---

## API Reference

### GET /regions
Returns all regions ranked by biodiversity score.
```json
{
  "regions": [
    {
      "region": "California",
      "biodiversity_score": 4.23,
      "unique_species": 342,
      "total_observations": 5210,
      "rank": 1
    }
  ]
}
```

### GET /regions/:id
Returns detail for one region. ID is lowercase, hyphenated (e.g., `new-mexico`).
```json
{
  "region": {
    "region": "California",
    "biodiversity_score": 4.23,
    "unique_species": 342,
    "total_observations": 5210
  },
  "trends": [
    { "year_month": "2021-05", "unique_species": 45, "observation_count": 120 }
  ],
  "decline_info": {
    "region": "California",
    "first_year_species": 300,
    "last_year_species": 342,
    "species_change": 42,
    "pct_change": 14.0
  }
}
```

### GET /trends
Returns global monthly trends and declining regions.
```json
{
  "monthly_trends": [
    { "year_month": "2021-05", "total_unique_species": 500, "total_observations": 2000, "regions_reporting": 10 }
  ],
  "declining_regions": [
    { "region": "Nevada", "pct_change": -12.5 }
  ]
}
```

### POST /explain
Sends region data to Gemini and returns AI explanation.
```json
// Request
{ "region": "California", "data": { "biodiversity_score": 4.23, "unique_species": 342, "species_change": 42, "pct_change": 14.0 } }

// Response
{ "region": "California", "explanation": "California's biodiversity is thriving..." }
```

### GET /health
```json
{ "status": "ok", "service": "bioscope-api" }
```

---

## Gemini Prompt Engineering

The key to winning the Gemini challenge is showing thoughtful prompt design. Our prompt:

1. **Sets the role:** "You are an ecology expert"
2. **Injects structured data:** biodiversity score, species count, trends, percent change
3. **Specifies output format:** 3 sections — summary, factors, recommendation
4. **Constrains length:** "under 200 words"
5. **Sets audience:** "accessible to a general audience"

### Tips for better explanations:
- Include the region name and specific numbers in the prompt
- Mention the Shannon Index by name — Gemini knows what it means
- Ask for "contributing factors" not just "reasons" — gets more ecological depth
- Add "cite specific ecological phenomena" for more impressive outputs

### If time permits, enhance with:
- Compare the region to the national average in the prompt
- Include neighboring regions' data for relative context
- Ask Gemini to suggest conservation actions specific to the region's biome

---

## ElevenLabs Integration (Stretch Goal — ~1 hour)

Add a "Listen" button next to the Gemini explanation that reads it aloud.

```typescript
// frontend/src/lib/elevenlabs.ts
const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice

export async function textToSpeech(text: string): Promise<string> {
  const res = await fetch(`${ELEVENLABS_API}/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.NEXT_PUBLIC_ELEVENLABS_KEY!,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.5 },
    }),
  });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
```

Add to RegionDetail.tsx:
```tsx
const [audioUrl, setAudioUrl] = useState<string | null>(null);

// After getting explanation:
const url = await textToSpeech(explanation);
setAudioUrl(url);

// In JSX:
{audioUrl && <audio controls src={audioUrl} className="mt-2 w-full" />}
```

---

## Devpost Submission Template

### Project Name
BioScope: Biodiversity Intelligence Platform

### Tagline
Turning citizen science into actionable biodiversity intelligence with cloud-native data pipelines and AI.

### Inspiration
Biodiversity loss is one of the most critical environmental challenges, but the data to understand it already exists — hidden in millions of citizen science observations. We built BioScope to make this data accessible, understandable, and actionable.

### What it does
BioScope ingests observation data from iNaturalist (the world's largest citizen science platform), processes it through a cloud data pipeline, and presents an interactive dashboard showing:
- Regional biodiversity scores using the Shannon Diversity Index
- Temporal trends in species diversity
- Fastest-declining regions that need conservation attention
- AI-powered ecological explanations for any region (powered by Google Gemini)

### How we built it
- **Data Pipeline:** Databricks notebooks fetch and clean iNaturalist observations using PySpark, computing Shannon diversity indices and temporal aggregations
- **Data Warehouse:** Snowflake ingests processed data via S3 external stages, providing SQL views for regional rankings and trend analysis
- **Backend API:** AWS Lambda + API Gateway expose RESTful endpoints that query Snowflake and proxy Gemini explanations
- **Frontend:** Next.js dashboard with interactive maps (react-leaflet) and trend charts (recharts), deployed on DigitalOcean App Platform
- **AI Layer:** Google Gemini 2.0 Flash generates contextual ecological explanations based on structured biodiversity metrics

### Challenges we ran into
[Fill in during hackathon — be honest, judges love authenticity]

### Accomplishments we're proud of
[Fill in during hackathon]

### What we learned
[Fill in during hackathon]

### What's next for BioScope
- Expand to all 50 US states and international regions
- Add real-time observation streaming from iNaturalist
- Integrate satellite imagery for habitat change detection
- Partner with conservation organizations for actionable alerts

### Built with
Databricks, PySpark, AWS Lambda, AWS S3, API Gateway, Snowflake, Next.js, TypeScript, Tailwind CSS, React Leaflet, Recharts, Google Gemini API, DigitalOcean, Python, iNaturalist API

---

## Pitching Script (3 minutes)

### Opening (30 seconds)
"Biodiversity is declining globally, and the data to understand it is already being collected by millions of citizen scientists on iNaturalist. But that data is scattered, unprocessed, and hard to act on. BioScope changes that."

### Demo (90 seconds)
1. Show the map — "Here's our dashboard. Each circle represents a US state. Size shows species count, color shows biodiversity health — green is good, red needs attention."
2. Click a region — "Let's look at California. We can see 342 unique species observed, a Shannon diversity index of 4.23, and a 14% increase in species diversity over 5 years."
3. Show the trend chart — "Here's the temporal trend — you can see seasonal patterns and the overall trajectory."
4. Click "Explain This Region" — "Now here's where it gets powerful. We send this structured data to Google Gemini, and it generates a plain-English ecological analysis. [Read the explanation aloud]"
5. Show the rankings table — "And here's every region ranked, so conservation groups know where to focus."

### Architecture (30 seconds)
"Under the hood: iNaturalist data flows through Databricks for processing, into S3 for storage, through Snowflake for analytics, served by AWS Lambda, and displayed on a Next.js app hosted on DigitalOcean. Every layer serves a purpose."

### Close (30 seconds)
"BioScope shows that the data to understand biodiversity loss already exists — it just needs the right pipeline to become actionable intelligence. Thank you."

### Judge Q&A Prep
- **"Why these specific services?"** — "Each service plays to its strengths: Databricks for distributed data processing, Snowflake for analytical queries, AWS for serverless compute, DigitalOcean for simple deployment."
- **"What's novel about this?"** — "The Shannon diversity index computation at scale, combined with AI-generated explanations, makes complex ecological data accessible to non-scientists."
- **"How would this scale?"** — "Everything is serverless or managed. Databricks handles larger datasets natively, Lambda scales automatically, Snowflake separates storage from compute."
- **"What's the real-world impact?"** — "Conservation organizations could use this to prioritize regions for intervention. City planners could assess biodiversity impacts of development."

---

## Environment Variables Needed

```env
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-west-2
S3_BUCKET_NAME=bioscope-data

# Snowflake
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USER=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_DATABASE=BIOSCOPE
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH

# Gemini
GEMINI_API_KEY=

# ElevenLabs (stretch)
ELEVENLABS_API_KEY=

# Frontend
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
```

---

## Quick Debugging Checklist

| Problem | Fix |
|---------|-----|
| CORS errors in browser | Enable CORS on API Gateway, redeploy. Check Lambda returns `Access-Control-Allow-Origin: *` header |
| Lambda timeout | Increase timeout to 30s. Snowflake cold connect takes ~5s |
| Snowflake connection fails | Check account identifier format: `ORGNAME-ACCTNAME` not the full URL |
| Map not rendering | react-leaflet needs `"use client"` and dynamic import with `ssr: false` |
| Leaflet CSS missing | Import `leaflet/dist/leaflet.css` in the map component |
| S3 access denied | Check IAM policy has `s3:GetObject` and `s3:ListBucket` on the bucket |
| Databricks can't write to S3 | Mount S3 bucket or use direct S3 path with credentials in cluster config |
| DigitalOcean build fails | Make sure `source_dir` is set to `/frontend` in app spec |
| Gemini returns errors | Check API key, ensure model name is `gemini-2.0-flash` |
| Charts not showing | Check data format matches recharts expected shape — needs `dataKey` to match object keys |

---

## Social Media (for Most Viral Idea challenge)

Post during the hackathon:
1. Photo of team at opening ceremony → "Starting DataHacks 2026! Building BioScope 🌿"
2. Screenshot of first Databricks data → "10,000 species observations flowing through our pipeline"
3. Screenshot of the map → "Biodiversity scores across the US — which state is greenest?"
4. Video of Gemini explanation → "AI explaining why California's biodiversity is thriving"
5. Final demo video → "BioScope is live! Built in 36 hours at @DataHacks"

Tag: @DataHacks @UCSD #DataHacks2026 #Hackathon #Biodiversity
