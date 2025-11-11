# Task Tracker

> Update this list as items move forward. Use the checkboxes to mark progress and add notes/dates as we go.

- [ ] Disable cron job auto-start in development/testing environments so local runs stay fast.
- [ ] Investigate the Hotelbeds Cache API 404 failures (confirm endpoint, credentials, headers, and fallback behaviour).
- [ ] Audit section-to-table extraction mapping against the schema to ensure fees, markets, taxes, and rates land in the correct tables.
- [ ] Verify room pricing coverage in `hotel_rates` and reconnect `{CNHF}` handling fees (new table or schema update) so cheapest-price logic has full cost data.
- [ ] Validate cheapest price recomputation pipeline using guidance from `docs/Hotelbeds_Cache_API_Cheapest_From_Price.txt` and update docs if logic changes.
- [ ] Profile CSV generation/import performance (batch sizes, concurrency, streaming) and propose optimisations to cut total runtime.
- [ ] Improve error handling/reporting when Hotelbeds endpoints return 4xx/5xx (surface actionable logs, implement retries/backoff as needed).
- [ ] Re-test known hotels missing rates after the above fixes and document results.
