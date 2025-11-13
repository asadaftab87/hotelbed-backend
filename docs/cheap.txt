# API Endpoints & Cheapest Price Logic

## Base Context

- API root: `/api/{version}/hotelbed` (version from `env.API_VERSION`).
- Jobs and cron runners ultimately call the same REST endpoints described below.
- `process` endpoint now runs the CSV generator, executes `import-all-csvs.js` for direct Aurora loads, refreshes hotel names, and recomputes the `cheapest_pp` table in one sweep.

## Operational Flow

1. `/process` (or cron) downloads the Hotelbeds ZIP, extracts per-destination hotel files, and builds CSV datasets under `downloads/csv_output/`.
2. The CSV importer reuses `import-all-csvs.js` to bulk load data into Aurora via `LOAD DATA LOCAL INFILE`. Set `USE_S3_PIPELINE=true` if the legacy S3 → Aurora path is required.
3. After load, placeholder hotel names are patched via the Content API, and `cheapest_pp` is rebuilt for CITY_TRIP (2 nights) and OTHER (5 nights) cohorts.
4. Search/read endpoints serve precomputed data from MySQL (and Redis when available) while `compute-prices` can recompute the cheapest table on demand.

## Endpoint Catalog

| Method | Path | Description |
| --- | --- | --- |
| GET | `/process` | Full ingest: download ZIP, generate CSV, load into DB, refresh names, rebuild `cheapest_pp`. |
| GET | `/update` | Incremental ingest using Hotelbeds update ZIP; reuses CSV + import pipeline. |
| GET | `/import-only` | Skip download; import from an already extracted folder in `downloads/` (`folder` query optional). |
| GET | `/hotels` | List hotels with optional pagination and filters (`destination_code`, `category`, `country_code`, `name`). |
| GET | `/hotels/{hotelId}` | Fetch complete hotel record with all related tables (contracts, inventory, rates, etc.). |
| GET | `/hotels/{hotelId}/rates` | Paginated rate rows for a single hotel. |
| GET | `/destinations` | Paginated destination catalogue. |
| GET | `/stats` | Record counts across the primary hotel tables. |
| POST | `/compute-prices` | Rebuild `cheapest_pp`; supports `category` (`CITY_TRIP`, `OTHER`, `ALL`) and optional `hotel_id` targeting. |
| GET | `/search` | Query the cached cheapest prices with filters on destination, category, name, price range, sort order, pagination. |
| GET | `/hotels/{hotelId}/available-rooms` | Paginated availability summary with optional date filters (`checkIn`, `nights`, `maxDates`). |
| GET | `/cheapest-status` | Quick health check for `cheapest_pp` (count and sample). |
| GET | `/check-availability` | Detailed availability + pricing for a specific hotel, date, and LOS; optional `room_code` filter. |

## Cheapest Price Logic

- Source data: `hotel_rates` (net rates) joined with `hotels`. Only positive prices are considered.
- Categories:
  - `CITY_TRIP`: exactly 2 nights, representing quick breaks (min LOS 2).
  - `OTHER`: 5-night stays for longer trips.
- Calculation:
  - For each hotel, compute `MIN(r.price)` across all rate keys, enforce the LOS multiplier (`price * nights`), then divide by two for price-per-person (double occupancy).
  - Board code defaults to `RO`, room code to `STD`; promotions flag currently `0` but can be extended once stacked discounts are integrated.
  - Results are upserted into `cheapest_pp` with unique key (`hotel_id`, `category_tag`).
- Automation:
  - `importToDatabase` truncates `cheapest_pp`, recomputes both categories, and logs counts.
  - `/compute-prices` endpoint and cron job reuse `HotelBedFileService.computeCheapestPrices`, allowing selective recompute by category or hotel.

## CSV & Import Notes

- CSV output directory: `downloads/csv_output/` (regenerated on each process run).
- Direct import relies on `import-all-csvs.js`, which disables FK/unique checks, batches `LOAD DATA LOCAL INFILE`, and re-enables constraints afterward. The script is callable on its own or via the service wrapper.
- Set `USE_S3_PIPELINE=true` to fall back to the S3 upload + `LOAD DATA FROM S3` path when Aurora IAM integration is available.

## Cron Integration

- Full sync (`fullSyncJob`): daily midnight execution of `/process`, validation of staging data, atomic table swap, `cheapest_pp` rebuild.
- Update sync (`updateSyncJob`): hourly `/update` for lighter-weight refreshes (skipped if full sync running).
- Cron jobs honour `ENABLE_CRON` environment flag and log each pipeline step for observability.

## Troubleshooting Checklist

- If `/process` fails after download, confirm DB credentials and that local infile is enabled. The new pipeline logs table-level load stats via `import-all-csvs.js`.
- Validate schema alignment (`database/hotelbed_complete_schema.sql`) when adding new columns to CSV writers.
- Use `/cheapest-status` and `/stats` to verify table counts after an import; `/compute-prices?hotel_id=XYZ` can patch individual hotels if needed.dr