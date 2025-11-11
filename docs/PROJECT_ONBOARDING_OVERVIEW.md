# Hotelbeds Cache API Backend – Onboarding Overview

## Project Purpose

- Deliver a high-performance Node.js + TypeScript backend that surfaces Hotelbeds inventory, availability, and pricing through cache-first APIs.
- Normalize Hotelbeds supplier files into a MySQL schema, precompute the cheapest sellable options per hotel, and expose them via REST endpoints backed by Redis.
- Support downstream consumers (web, partners, analysts) with deterministic, auditable price maths and CSV exports for further pricing analysis.

## Architecture Snapshot

- **API layer:** Express service under `src/api/components/hotelBed` offering cheapest price search, availability matrix, static content, and operational endpoints (e.g., `computeCheapestPrices`, `searchHotels`, `getCheapestStatus`).
- **Business services:** `src/services` orchestrates repositories, enforces promotions/eligibility, and logs via shared `core/Logger` utilities.
- **Data access:** Raw SQL lives in `database/` (e.g., `compute_cheapest_prices.sql`, `enhance_cheapest_pp.sql`) and repository classes execute the statements against MySQL.
- **Caching:** Redis keys follow cache-aside patterns for min-price snapshots, detailed rate payloads, and static assets; TTLs differ by data type (minutes for availability, hours for content).
- **Jobs & scripts:** `src/cron/jobs.ts` coordinates ingest + recompute flows, while root-level helper scripts (`import-csvs.js`, `import-fast.js`, `update-cheapest-names*.js`) manage bulk loads, CSV ingestion, and data hygiene.
- **Downloads & CSVs:** Generated CSVs land under `downloads/csv_output/`; import scripts use `LOAD DATA LOCAL INFILE` to hydrate Aurora/MySQL tables for pricing analysis or regression checks.

## Data & Pipeline Flow

1. **Ingest:** Scheduler downloads Hotelbeds cache ZIPs, verifies payloads, stages data, and upserts normalized tables (hotels, rooms, rate plans, availability, promotions).
2. **Delta refresh:** Delta jobs capture changes (new hotels, adjusted rates, policy updates) to minimize processing overhead and API load.
3. **Precompute (E.P.P):** Dedicated jobs run the price pipeline to calculate End-user Payable Price for all LOS/occupancy combinations, select the cheapest valid option, and persist into `cheapest_pp` with descriptive badges.
4. **Validation:** Sampling jobs compare cached totals against live CheckRates; large deviations trigger targeted invalidations and recomputes.
5. **API serving:** Redis delivers cached responses instantly; stale-while-revalidate keeps data fresh while safeguarding latency targets (sub-150 ms for cache hits, ≤500 ms for `/search`).
6. **Fallbacks:** Availability gaps trigger next-best suggestions (next date, alternative board) so the UX remains actionable even when a requested stay is unavailable.

## Documentation Map (docs/)

| File | What it Covers |
| --- | --- |
| `Hotelbeds_Cache_API_Cheapest_From_Price.txt` | Business rules for “cheapest from” totals: LOS thresholds (2-night city trips, 5-night others), free-night handling (3=2 etc.), pricing normalization, Redis caching strategy, and output schema per hotel. |
| `Hotelbeds_Cache_API_End_to_End_Price_Calculation.txt` | Full price pipeline blueprint: eligibility checks, nightly vector maths, promotion stacking (fixed → percent → free nights), tax/fee scopes, currency FX, margin application, pay-now vs pay-at-hotel split, and audit expectations. |
| `Hotelbeds_Cache_API_Playbook_Explained (1).txt` | Annotated walkthrough of the same pipeline with principles, canonical inputs, promotion semantics, worked examples, implementation pseudocode, QA checklist, and a glossary. |
| `Hotelbeds_Cache_API_Core_Concepts.txt` | Defines availability, sync intervals, and fallback logic—core primitives shared across ingest, cache refreshing, and UI behaviour. |
| `Hotelbeds_Cache_API_Availability_Sync_Fallback.txt` | Detailed design for availability storage, seasonal sync cadence, fallback messaging, SWR behaviour, and resilience tactics (circuit breakers, telemetry). |
| `Hotelbeds_Cache_API_Key_Considerations.txt` | Checklist of architectural guardrails: key naming, TTL strategy, price correctness safeguards, cache invalidation tactics, rate limiting, observability, and security constraints. |
| `Hotelbeds_Cache_API_Checklist.txt` | End-to-end programme checklist covering ingest, precompute, API contracts, database structure, security, CI/CD, and frontend integration readiness. |
| `Hotelbeds_Cache_API_Integration_NodeJS.txt` | Node.js developer brief: responsibilities, deliverables, tech stack, filter support, and city-trip vs other-category pricing nuances. |
| `hotelbeds_cache_jobs_combined.txt` | Consolidates delta, validation, and precompute job responsibilities plus price pipeline steps and expected monitoring. |
| `delta_validation_jobs.txt` | Deep dive on delta vs validation job roles, why they coexist, and the combined benefit for cache freshness and accuracy. |
| `precompute_job_epp_prices.txt` | Specific SOP for the E.P.P precompute batch: scope selection, data retrieval, promotion matrix execution, storage, monitoring, and validation outputs. |
| `price_pipelines.txt` | High-level primer on price pipeline stages and benefits (modularity, reusability, traceability). |
| `hotel_pricing_terms_with_codes.txt` | Glossary translating Dutch/English pricing terminology and coded promotion buckets (CNSU, CNGR, etc.) for consistent interpretation across systems. |

## Cheapest Price Focus

- The API prioritises the `cheapest_pp` table; cron routines truncate and repopulate it after running the SQL in `src/cron/jobs.ts`, logging processed rows and speed.
- Promotions such as free nights or stacked discounts must be honoured exactly once in the pipeline to prevent double counting; docs emphasise promotion precedence and exclusivity groups.
- Validation jobs keep cheapest totals trustworthy by comparing cached values to live API results; deviations above ~2–3% lead to re-sync.
- When cheapest computations run per hotel/category, the system records badges (free night, refundable, board type) to surface in UI/CSV exports.

## CSV & Pricing Extraction Tooling

- `import-csvs.js` and related scripts load generated CSVs (inventory, rates) into Aurora/MySQL for offline analysis or backfilling; they verify counts for test hotels to confirm data health.
- Scripts like `analyze-rates.js`, `check-pricing.js`, `update-cheapest-pp-names.js`, and `process-contracts*.js` assist with ad-hoc diagnostics, pricing checks, and contract ingestion.
- `downloads/` hosts exported raw data and generated CSVs, enabling repeatable reproduction of pricing discrepancies before they surface in production.

## Operational Playbook

- **Sync cadence:** Adjust intervals seasonally (1–2 min in peak, 5–15 min otherwise) and shorten horizons when variance spikes.
- **Cache governance:** Use deterministic keys (dest/date/occupancy) with versioning for targeted invalidation; prefer SWR to balance freshness vs latency.
- **Monitoring:** Track cache hit/miss, latency, CheckRates delta, fallback usage, batch duration, deviation counts, and queue backlogs.
- **Safety nets:** Employ retries with jitter, circuit breakers leading to cache-only mode, and structured logging with correlation IDs; protect secrets via vault/IP allow lists.

## Getting Started Checklist for a New Agent

1. Install dependencies via `pnpm` or `npm`, configure `.env`, and ensure MySQL + Redis access.
2. Load schema (`database/*.sql`) followed by CSV imports to populate hotel inventory, rates, and cheapest tables.
3. Run `src/cron/jobs.ts` tasks (or equivalent scripts) to compute `cheapest_pp` and validate counts.
4. Exercise key endpoints (`/hotelbeds/compute-cheapest`, `/hotelbeds/search`, `/hotelbeds/availability`) to confirm cache hydration and pricing outputs.
5. Review docs above when implementing or debugging: use the checklist for scope, the price calculation guide for algorithmic correctness, and the availability sync document for scheduling/fallback behaviour.
6. For pricing issues, cross-check CSV exports, run validation jobs, and compare against live CheckRates before adjusting promotion logic.

With this overview and the referenced documents, an engineer or agent can quickly understand the system boundaries, required jobs, pricing logic, and the tooling available to focus on the “cheapest” price experience.
