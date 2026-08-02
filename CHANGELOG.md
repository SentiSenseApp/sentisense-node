# Changelog

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
