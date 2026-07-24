# Changelog

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
  removed. Use `kb.getPopularEntities()` / `kb.getAllEntities()`.
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
