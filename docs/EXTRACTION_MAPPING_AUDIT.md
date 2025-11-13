# Extraction ↔ Database Mapping Audit

Date: 2025-11-11

This audit compares the intended Hotelbeds Cache API extraction (see `docs/Extracttion.txt`) with the current CSV generation code (`src/utils/csvGenerator.ts`) and the bulk loader (`import-all-csvs.js`). The goal is to ensure every required block lands in the correct table with all attributes needed for pricing and downstream logic.

## Legend

- **OK** – Mapping aligns with schema (allowing for nullable extras such as timestamps).
- **Partial** – Data is loaded but important fields are missing or discarded.
- **Mismatch** – Output is written to the wrong table/column, causing data loss.
- **Missing** – Block is generated but never imported, or not generated at all.

## Summary Table

| Block / File | Expected Content (per spec) | CSV fields emitted | Target table / loader mapping | Status | Impact / Notes |
| --- | --- | --- | --- | --- | --- |
| `GHOT_F` | Hotel master data | `id, category, destination_code, chain_code, accommodation_type, ranking, group_hotel, country_code, state_code, longitude, latitude, name` | **Not loaded** by `import-all-csvs.js`; only the S3 pipeline loads `hotels` | **Missing** | Direct import path never refreshes `hotels`, so new properties/names never reach DB. |
| `IDES_F` | Destinations | `code, country_code, is_available` | Not loaded in direct import | **Missing** | Destination catalogue stays stale during local/cron imports. |
| `GCAT_F` | Categories | `code, simple_code` | Not loaded in direct import | **Missing** | Category table not refreshed. |
| `{CCON}` | Contracts (currency, payment, markets) | `destination_code, contract_code, rate_code, board_code, contract_type, date_from, date_to, currency, board_type` | `hotel_contracts` columns `(hotel_id,destination_code,contract_code,rate_code,board_code,contract_type,date_from,date_to,currency,board_type)` | **Partial** | `payment_type`, `market`, `is_active` stay NULL. Acceptable if optional, but review if needed for filtering. |
| `{CNHA}` | Room allocations | `room_code, board_code, min/max adults, min/max children, min/max pax, allocation` | Mapping identical | **OK** | — |
| `{CNIN}` / `{SIIN}` | Inventory | `date_from, date_to, room_code, board_code, availability_data` | Mapping identical | **OK** | — |
| `{CNCT}` / `{SIAP}` | Rates (price, tax, currency, commission) | `room_code, board_code, date_from, date_to, rate_type, base_price, tax_amount, adults, board_type, price` | Loader columns `(hotel_id,room_code,board_code,date_from,date_to,rate_type,base_price,tax_amount,adults,board_type,price)` | **Partial** | `commission` and `currency` in schema remain NULL. If Hotelbeds delivers multiple currencies, this breaks pricing. |
| `{CNSU}` | Supplements | `date_from, date_to, supplement_code, supplement_type, discount_percent, min_nights` | Same | **Partial** | Schema expects `applies_to`; currently NULL. |
| `{CNOE}` | Occupancy rules | `rule_from, rule_to, is_allowed` | Same | **OK** | — |
| `{CNEM}` | Email / notification rules | `date_from, date_to, email_type, room_type, room_code, email_content` | Loader maps `(hotel_id,date_from,date_to,notification_type,@dummy,room_code,@dummy2)` | **Mismatch** | `email_type` saved to `notification_type`, but `room_type`/content discarded. Schema columns `board_code`, `min_pax`, etc. mismatch. |
| `{CNTA}` | Rate tags | `rate_code, tag_type, tag_value` | Loader `(hotel_id,@dummy,tag_name,@dummy2)` | **Mismatch** | Only tag name saved; rate linkage lost. |
| `{CNCF}` | Configurations | `config_key, config_value, date_from, date_to` | Loader `(hotel_id,date_from,date_to,criteria_id,@dummy)` | **Mismatch** | `config_key/value` never stored; instead dates populate wrong columns. |
| `{CNPV}` | Promotions | `promo_code, promo_type, date_from, date_to, discount_value` | Same | **Partial** | Schema column `promotion_data` (TEXT) would not match structured fields; need schema or loader update to persist structured values. |
| `{CNSR}` | Special requests | `request_code, request_type, request_description` | Loader `(hotel_id,request_data,@dummy,@dummy2)` | **Mismatch** | Only code stored in `request_data`; rest lost. |
| `{CNGR}` | Groups | `group_code, group_type, date_from, date_to` | Loader `(hotel_id,group_data,@dummy,@dummy2,@dummy3)` | **Mismatch** | `group_data` receives only `group_code`; rest discarded. |
| `{CNCL}` | Valid markets | `country_code, valid flag, maybe window` | Writer stores `policy_code, days_before, penalty_percent, penalty_amount` | **Mismatch** | We are treating markets as cancellation penalties, so markets are absent and cancellation data wrong. |
| `{CNES}` | Special conditions | `condition_code, condition_type, text` | Mapping identical | **OK** | — |
| `{CNHF}` | Handling fees | Writer treats as `room_code, feature_code, feature_value` | Loaded into `hotel_room_features` | **Mismatch** | Fees not stored; schema `hotel_room_features` also expects `feature_type` which we do not populate. |
| `{CNPR}` (pricing rules) | Adjustment logic | `rule_code, rule_type, date_from, date_to, adjustment_value` | Loader maps `modifier_value` but schema expects `modifier_type` etc | **Partial** | Adjustment value captured, but modifier type/data lost. |
| `{ATAX}` | Taxes (per-night/per-pax flags, market code) | `date_from, date_to, room_code, board_code, tax_code, included_flag, max_nights, min_age, max_age, per_night, per_pax, amount, percentage, currency, apply_over, market_code, legal_text` | `hotel_tax_info` `(hotel_id,date_from,date_to,room_code,board_code,tax_code,included_flag,max_nights,min_age,max_age,per_night,per_pax,amount,percentage,currency,apply_over,market_code,legal_text)` | **OK (2025-11-11)** | Direct importer now loads the complete tax dataset; monitor post-import validation for NULL flags. |
| `{CNNH}` | Roulette descriptions | — | Not generated | **Missing** | Content absent entirely. |

## Pricing Impact

- Missing `currency`, `commission`, `tax` and `fee` data directly leads to NULL or incomplete totals in `hotel_rates`, which explains hotels showing missing or zero prices.
- `{ATAX}` now loads into `hotel_tax_info`; `{CNHF}` remains outstanding, so fees are still missing from the “Cheapest From Price” pipeline.
- `{CNCL}` mis-mapping makes market-based availability filters impossible; `{CNTA}` mis-mapping breaks tag-driven rules.

## Recommended Fixes (ordered)

1. **Loader parity**
   - Extend `import-all-csvs.js` to load `hotels`, `destinations`, `categories`, `hotel_tax_info`, and the planned handling-fees table.
   - Align column lists with schema (add currency, commission, applies_to, modifier_type, etc.).

2. **CSV generator alignment**
   - Update `writeTaxInfo`, `writeContracts`, `writeSupplements`, `writePricingRules`, etc., to emit all schema columns (e.g., include currency, commission, applies_to, modifier_type, feature_type).
   - Split `{CNHF}` into a proper `hotel_handling_fees.csv`; keep room features for actual feature blocks (if any).
   - Correct `{CNCL}` writer to follow market spec (store country validity) and add a dedicated table if cancellation penalties come from a different block.

3. **Schema adjustments (if needed)**
   - Decide whether to keep TEXT catch-all columns (e.g., `promotion_data`) or switch to structured columns matching emitted CSVs.

4. **Validation tooling**
   - Add a post-import audit that reports NULL rates, missing currencies, or hotels lacking `{CNCT}` rows.

With these fixes in place, every record coming from the Hotelbeds Cache ZIP will land in the expected table and pricing calculations will have the inputs required to avoid NULL totals.
