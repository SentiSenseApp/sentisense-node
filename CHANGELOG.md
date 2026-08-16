# Changelog

## 0.39.0

### Added

- **`priceAsOf` on `StockPrice` and `StockQuote`**: when the market data behind `currentPrice`
  is from, in Unix milliseconds. Read it for freshness rather than `timestamp`, which is when
  the response was served and therefore always reads as now. Absent means unknown age, not fresh.

### Fixed

- `timestamp` is no longer documented as the price's age; it is the serve time of the response.

## 0.38.0

### Added

- **`client.screener`, a new resource for filtering the tracked universe.** `fields()` returns
  the full filterable catalog for both universes, `screens()` returns the curated screens
  shipped in the product, and `run({ plan, tickers, limit })` / `runEtfs({ plan, tickers, limit })`
  execute a plan against the stock and ETF universes. A plan is `{ filters, sort }` with each
  filter `{ fieldName, op, value }`, ANDed together. `limit` rides next to the plan on the
  request body rather than inside it, defaults to 100 and caps at 500; `tickers` is optional and
  omitting it screens the whole tracked universe.
- **Results carry `matched`, the pre-limit count**, so truncation is visible, and every row
  carries the full field set rather than only the fields you filtered on.
- **A curated `screen.plan` round-trips straight into `run()`** with nothing to rebuild. Those
  plans identify the field with `field` rather than `fieldName`; both keys are accepted on the
  way in, and `ScreenerFilter` / `ScreenerSort` type both.
- **New types**: `ScreenerFieldCatalog`, `ScreenerFieldDescriptor`, `ScreenerFieldOption`,
  `ScreenerPlan`, `ScreenerFilter`, `ScreenerSort`, `FeaturedScreen`, `ScreenerScreensResponse`,
  `ScreenerExecuteOptions`, `ScreenerExecuteResponse`, `ScreenerRow`,
  `EtfScreenerExecuteResponse`, `EtfScreenerRow`.

### Notes

- Three field semantics are documented on the resource because guessing them wrong produces a
  screen that looks fine and means nothing: `ANALYST_RATING_MEAN` is inverted (1.0 is strong
  buy, so bullish is `LTE`), `MA_CROSS_STATE` is ordinal (`1` golden cross, `-1` death cross,
  `0` neither), and `SENTIMENT_DIRECTION` is the sign of the 7-day SentiSense Score with a
  neutral band of plus-or-minus 5, not a polarity reading.
- Filter the Score fields on the band edges 5 / 13 / 23. Polarity-scale values like `0.5`
  behave as "any positive score". Nulls never match in either direction.

## 0.37.0

### Added

- **Listing lifecycle on `StockPrice` and `StockProfile`: `listingStatus`, `delistedDate`
  and `delistingReason`.** The same three fields `StockQuote` already declared are now typed
  on the price and profile responses, so they read without a cast. They are absent for an
  ordinarily listed stock, which is almost every ticker. `"DELISTED"` means every price
  field is frozen at the last trade before `delistedDate`, so do not render `changePercent`
  as a market move; `"PENDING_DELISTING"` means a merger or take-private is scheduled while
  the stock still trades, so the figures are current.

## 0.36.0

### Added

- **`client.earnings`, a new resource for what a company actually reported.**
  `getSummaries(ticker, { limit })` returns the per-quarter analysis report, newest first: one
  `EarningsQuarter` per fiscal period carrying the editorial headline, the KPI cards with
  year-over-year deltas, the guidance language as management phrased it, and a summary of
  the earnings call. It answers on the preview envelope, so branch on `isPreview`: a PRO
  key receives every hydrated quarter in full, a FREE key receives the latest quarter
  shaped rather than truncated (section titles in `summaryTopics` and `transcriptTopics`,
  `guidanceDirection` in place of the guidance language, two KPI cards plus
  `kpiHighlightCount`). A ticker with no stored quarter answers with an empty `data`
  array rather than a 404, and a quarter can gain its call summary on a later read, so
  branch on `hasTranscript` and read `transcriptGeneratedAt` rather than assuming a fixed
  lag.

- **`client.earnings.getRecent({ days, limit })`.** The cross-ticker view of who reported
  recently, newest first, as `RecentEarningsEntry` rows. Every key receives the full
  window it asks for. The window is bounded by `reportDate`, so a quarter reported inside
  it appears even when its call summary lands later. This is the backward-looking feed;
  `calendar.getEarnings()` remains the forward-looking one.

- New exported types: `EarningsQuarter`, `EarningsKpiHighlight`, `EarningsSource`,
  `RecentEarningsEntry`, `GetEarningsSummariesOptions` and `GetRecentEarningsOptions`.

## 0.35.0

### Added

- **`client.indexes`**: `list()`, `get(indexId)` and `history(indexId, days)`, with
  types for the listing, the snapshot, its constituents and the history series. A basket
  index fills `constituents`, `basketSize`, `coverage` and `totalMentions`; a composite
  index returns `null` for all four by construction, so check before iterating.

## 0.34.1

### Deprecated

- **`GetAISummaryOptions.forceRefresh` is deprecated and is no longer sent.** Stock
  reports are curated and served as published, so the option never changed the report a
  caller received. It stays in the type, marked `@deprecated`, so existing code keeps
  compiling; `getAISummary` now discards it rather than forwarding it. Drop it from your
  call. `depth` is unaffected.

## 0.34.0

### Fixed

- **The package is importable again from an ESM TypeScript project.** The `exports` map
  hoisted a single `types` entry above the `import` / `require` conditions, so under
  `module` / `moduleResolution: "NodeNext"` an ESM consumer resolved the CommonJS
  declarations for the ESM entry point and `new SentiSense()` failed to compile with
  `TS2351: This expression is not constructable`. That is the first line of the Quick Start,
  so the package was unusable in that configuration. Types are now declared per condition,
  pointing at the declaration file that matches each entry point. Bundler-style resolution
  was unaffected and stays unaffected.
- **`exports` now includes a `./package.json` subpath.** Tooling that reads a dependency's
  manifest through its export map (bundler plugins, framework CLIs, some test runners) threw
  `ERR_PACKAGE_PATH_NOT_EXPORTED` instead of getting the file.
- **`RateLimitError.retryAfter` can no longer be `NaN` or unbounded.** 0.33.0 clamped
  `Retry-After` inside the client's own retry loop but handed the raw header value to the
  error object, so a caller running its own backoff off `error.retryAfter` got `NaN` from an
  HTTP-date (`setTimeout` fires immediately on `NaN`, turning polite backoff into a hot loop)
  or a multi-hour wait from an oversized value. It is now clamped to `[0.5, 120]` seconds,
  and is `undefined` rather than `NaN` when the header is absent or unparseable.
- **Chart adjustment boundary corrected in the docs.** `GetChartOptions.timeframe` claimed
  that `"5Y"` and longer are split- and dividend-adjusted. Only `"10Y"` and `"MAX"` are: a
  `"5Y"` weekly close matches the `"1Y"` daily close for that week's last trading day, while
  the `"10Y"` bar for the same week is lower by the dividends paid since. Anyone diffing two
  ranges was reading that gap as a data bug.
- **`PreviewResponse.totalCount` documented accurately.** It said the field is absent on full
  PRO responses. It is present whenever the server knows the full size, including on a PRO
  response from a paged endpoint such as `politicians.getActivity`.
- **`SentimentSourceTone.mentionShare` and `StockSentiment.socialDominance` units.**
  `mentionShare` is a whole-number percent, rounded per source, so the array sums to about
  100 rather than exactly 100 (101 is common and is not a data error);
  `socialDominance` is a fraction (0.021 is 2.1%). They look interchangeable and are not.
- **`examples/news-search.ts` compiles.** It read a `topDocuments` field and passed an
  `expanded` option, neither of which the API has. `npm run typecheck` now covers `tests/`
  and `examples/` as well as `src/`, so a wrong signature in either is a build failure
  rather than something only a reader notices.

### Added

- **Paging and sorting on `institutional.getHolders`.** A widely held ticker is roughly
  6,000 rows and 1.5 MB per quarter. The new optional options object takes `limit`, `offset`,
  `sortBy` (`"shares"`, `"valueUsd"`, `"sharesChangePct"`) and `sortDir`. Omitting it sends
  the original unbounded request, so existing calls are unchanged. Note that `limit` is what
  activates the rest: sent without it, `offset` and the sort options are ignored server-side.
- **`TickerHolders.returnedCount`, `.offset` and `.notableChanges`.** A response to a request
  carrying `limit` returns all three, so a paging caller can size the walk and see the
  quarter's biggest position moves without scanning every page. All three are optional
  because the unbounded response omits them. `HolderNotableChanges` is exported.
- **`Holder.entitySlug` and `Holder.cikCount`.** `entitySlug` goes straight to
  `institutional.getInstitutionDetail()`; `cikCount` is populated when a row rolls up several
  SEC filers under one manager. Both are null for filers with no institution page.
- **Paging on `politicians.getActivity`.** A 90-day window is routinely well over a thousand
  disclosures and the server returns 200 by default with nothing in the payload to say it
  stopped. The new optional `limit` and `offset` (type `GetPoliticianActivityOptions`, which
  extends `GetPoliticiansOptions`) walk the rest; read `totalCount` on the envelope for the
  real size. Calling with no arguments sends exactly the request it always did.
- **`StockQuote.reportedCurrency`.** Names the currency the issuer reports in, matching
  `Fundamentals.reportedCurrency`. Absent means unknown, not USD.
- **`Document.sourceName`.** Publisher name for a news article, null on social sources where
  `source` already names the platform. It was on the wire but not on the type.

## 0.33.0

### Added

- **`stocks.getSentiment(ticker)`.** One call for a stock's headline sentiment picture: the
  SentiSense Score with its 30-day regime (`sentisenseScore`, `sentisenseScoreAvg30d`,
  `scoreLabel`, `direction`, `trend`, `scoreSparkline`), mention volume and social dominance,
  per-source tone in `bySource`, plus related tickers, story drivers, a narrative and an FAQ.
  Available in full on every API-key tier. Use
  `entityMetrics.getMetrics(ticker, "sentiment", ...)` instead when you need a time series over
  a specific window.
- **Long chart timeframes: `5Y`, `10Y` and `MAX`.** `stocks.getChart` now accepts the deep-history
  ranges in addition to the existing intraday and multi-month options. `ALL` remains accepted as an
  alias of `5Y`.
- **Automatic retry on deep-history warm-up.** Deep chart ranges can answer `202 Accepted` while the
  series is still being assembled. The client now waits for the interval the server asks for and
  retries, instead of surfacing the `202` as a result. If the data is still unavailable when the
  retries are exhausted it throws `DeepHistoryUnavailableError`, so a warm-up is never mistaken for
  an empty chart.
- **Cash-flow fields on `Fundamentals`.** `operatingCashFlow`, `capitalExpenditure` and
  `freeCashFlow` are now typed on the fundamentals response.
- **`Fundamentals.reportedCurrency`.** Fundamentals responses now name the currency the filer
  reports in ("USD", "KRW", "EUR", ...). Statement figures are as reported in that currency and
  are never converted to US dollars; foreign companies listed as ADRs file in their home
  currency while their listed share price is in USD. When the field is absent the currency is
  unknown, not implicitly USD. For non-USD filers the API serves `peRatio` / `psRatio` /
  `pbRatio` as `null` on purpose: a USD price over a home-currency per-share figure is a unit
  mismatch, so do not recompute them client-side.

### Fixed

- **`Retry-After` is now validated and clamped.** A large value previously left the client
  waiting for its full duration, and a non-numeric value (the header may legally carry an
  HTTP-date) parsed to `NaN`, which compared false against every threshold and retried
  immediately in a busy loop. Waits are now bounded at 30 seconds for deep-history retries and
  120 seconds for rate limiting, and any non-finite value falls back to the default wait.
- **`VERSION` now matches `package.json`.** The two had drifted, so the client advertised a
  stale version in its `User-Agent`.

## 0.31.0

### Breaking (removed)

- **`kb.getAllEntities`.** The unpaginated full-entity dump endpoint has been retired
  server-side (HTTP 410). Use `kb.getPopularEntities()` for suggestions, or
  `stocks.getEntities(ticker)` for the entities related to a ticker.

## 0.30.0

Removed methods whose endpoints no longer work. Both were unusable at runtime, so this
breaks only code that was already failing.

### Breaking (removed)

- **`entityMetrics.getMentions` / `getMentionCount` / `getMentionCountBySource` /
  `getSentiment` / `getSentimentBySource` / `getAverageSentiment`.** These called the v1
  `/entity-metrics/` endpoints, which the API retired in March 2026 (HTTP 410). Use
  `entityMetrics.getMetrics(symbol, { metricType })` and
  `entityMetrics.getDistribution(symbol, metricType)` instead.
- **`kb.getEntity`.** Its endpoint returned 400/404 for every id form, so it never worked;
  removed. Use `kb.getPopularEntities()`. (This entry originally also pointed at
  `kb.getAllEntities`, which was itself removed in 0.31.0.)
- Removed the now-orphaned exported types tied to those methods (`MentionData`,
  `MentionCount`, `SentimentData`, `EntityMetricsDateRange`, `GetMentionsOptions`,
  `GetMentionCountOptions`, `GetSentimentBySourceOptions`).

## 0.29.0

Corrects the declared return types of the methods whose responses are wrapped, so the
documented access pattern type-checks natively and the compiler rejects the old flat
access. Runtime behavior is unchanged: these endpoints have always returned the wrapper,
so any code that read the flat shape was already getting `undefined` or throwing.

### Breaking (types only)

Fourteen methods' return types now describe the wrapper the server actually sends. If your
code used the old (flat) shape, it was already broken at runtime; update the access site:

| Method(s) | Was `Promise<…>` | Now `Promise<…>` | Old access → new access |
|---|---|---|---|
| `institutional.getFlows` | `InstitutionalFlowsResponse` (flat) | `PreviewResponse<InstitutionalFlows>` | `r.inflows` → `r.data.inflows` |
| `institutional.getHolders` | `Holder[]` | `PreviewResponse<TickerHolders>` | `r.filter(...)` → `r.data.holders.filter(...)` |
| `institutional.getActivists` | `Holder[]` | `PreviewResponse<Holder[]>` | `r.length` → `r.data.length` |
| `insights.stock` / `stockRange` / `market` / `latest` / `user` | `Insight[] \| InsightPreviewResponse` | `PreviewResponse<Insight[]>` | `for (i of r)` → `for (i of r.data)` |
| `documents.getByTicker` / `getByTickerRange` / `getByEntity` / `search` / `getBySource` | `Document[]` | `DocumentSearchResponse` | `for (d of r)` → `for (d of r.documents)` |
| `stocks.getFundamentalsPeriods` | `FundamentalsPeriod[]` | `FundamentalsPeriodsResponse` | `r.map(...)` → `r.periods.map(...)` |
| `stocks.getCurrentFundamentals` | `Fundamentals` | `TtmFundamentals` | precise TTM fields (`peTTM`, `epsTTM`, …) instead of an index signature |

Unchanged (already correct): `stocks.getPrice` / `getChart` / `getQuote`,
`documents.getStories` / `getStoryDetail` / `getStoriesByTicker`, `insights.types`,
`institutional.getQuarters` / `listInstitutions`.

### Added

- Exported types for the wrappers: `InstitutionalFlows`, `TickerHolders`,
  `DocumentSearchResponse`, `FundamentalsPeriodsResponse`, `TtmFundamentals`.
- `InstitutionalFlowsResponse` and `InsightPreviewResponse` are retained but marked
  `@deprecated`; the former still aliases the inner flows payload.

## 0.28.0

- `institutional.getFlows`: `reportDate` is now optional (omit it for the latest quarter);
  added `isPending` / `filerCount` / `baselineFilerCount` coverage fields.
- Documented the response-shape wrappers in the README; fixed the example files that read
  the inner payload directly.
- `MarketSummary.totalMentions` / `topActiveStocks` documented as no longer populated.
