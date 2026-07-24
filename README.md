# sentisense

[![npm version](https://img.shields.io/npm/v/sentisense.svg)](https://www.npmjs.com/package/sentisense)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK for the [SentiSense](https://sentisense.ai) market intelligence API.

## Install

```bash
npm install sentisense
```

## Quick Start

```typescript
import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: "ss_live_YOUR_KEY" });

const price = await client.stocks.getPrice("AAPL");
console.log(price.currentPrice);

// reportDate is optional; omit it to get the latest available quarter
// (this one returns a wrapper: see "Response shapes" below)
const flows = await client.institutional.getFlows();
```

## Features

- Full TypeScript support with detailed type definitions
- Works in Node.js 18+, Deno, Bun, and browsers
- Zero runtime dependencies (uses native `fetch`)
- Namespaced API resources (stocks, documents, institutional, etc.)
- Typed error hierarchy for clean error handling

## Response shapes

Most methods resolve to the payload directly, but two families wrap it.

> **Known issue: some declared return types describe the inner payload rather than the
> wrapper.** For the methods listed below, the runtime value is the wrapper, so reading the
> declared shape gives you `undefined` even though it compiles. Cast to the wrapper type
> (each is exported) until the declarations are corrected in a future release. The runtime
> behavior is stable and is what is documented here.

**1. Tier-gated endpoints return a preview envelope.** The payload is in `data`, and
`isPreview` tells you whether it was truncated for your tier. On a truncated response
`totalCount` carries the untruncated size, so you can render "showing N of M".

Affected: `institutional.getFlows` / `getHolders` / `getActivists`, and all five
`insights` methods.

```typescript
import type { InstitutionalFlows, PreviewResponse, TickerHolders } from "sentisense";

const flows = (await client.institutional.getFlows()) as unknown as
  PreviewResponse<InstitutionalFlows>;

if (flows.isPreview) {
  console.log(`Preview: ${flows.data.inflows.length} of ${flows.totalCount}`);
}
for (const flow of flows.data.inflows) {
  console.log(flow.ticker, flow.netSharesChange);
}

// holders nest one level deeper: ticker-level totals plus the rows
const holders = (await client.institutional.getHolders("AAPL", "2026-06-30")) as unknown as
  PreviewResponse<TickerHolders>;
console.log(`${holders.data.holderCount} holders`);
const newPositions = holders.data.holders.filter((h) => h.changeType === "NEW");
```

**2. Document endpoints return a search wrapper.** This is not the preview envelope:
the rows are in `documents` and there is no `isPreview`.

Affected: `documents.getByTicker` / `getByTickerRange` / `getByEntity` / `search` /
`getBySource`. Also `stocks.getFundamentalsPeriods`, whose periods are in `periods`.

```typescript
import type { DocumentSearchResponse } from "sentisense";

const results = (await client.documents.search("NVDA earnings", { days: 7 })) as unknown as
  DocumentSearchResponse;

console.log(`${results.totalCount} matches`);
for (const doc of results.documents) {
  console.log(doc.url, doc.averageSentiment);
}
```

Everything else, including `stocks.getPrice()`, `documents.getStories()`,
`insights.types()` and `institutional.getQuarters()`, resolves to the value itself with no
wrapper and needs no cast.

## API Reference

### Stocks

```typescript
client.stocks.list()                                    // All ticker symbols
client.stocks.listDetailed()                            // All stocks with details
client.stocks.getPrice("AAPL")                          // Real-time price
client.stocks.getPrices(["AAPL", "NVDA"])               // Batch prices
client.stocks.getProfile("AAPL")                        // Company profile
client.stocks.getChart("AAPL", { timeframe: "6M" })     // OHLCV chart data
client.stocks.getMarketStatus()                         // Market open/closed
client.stocks.getFundamentals("AAPL")                   // Financial data
client.stocks.getShortInterest("GME")                   // Short interest
client.stocks.getAISummary("AAPL", { depth: "deep" })   // AI report (PRO)
```

### Documents & News

```typescript
client.documents.getByTicker("AAPL", { source: "news", days: 3 })
client.documents.search("NVDA earnings", { days: 7, limit: 20 })
client.documents.getStories({ limit: 10 })
client.documents.getStoryDetail("cluster_abc123")
```

### Institutional Flows (13F)

```typescript
client.institutional.getQuarters()
client.institutional.getFlows("2025-02-14", { limit: 20 })
client.institutional.getHolders("AAPL", "2025-02-14")
client.institutional.getActivists("2025-02-14")
```

### Entity Metrics

```typescript
// Time-series metrics (v2 API)
client.entityMetrics.getMetrics("AAPL", { metricType: "sentiment" })
client.entityMetrics.getMetrics("AAPL", {
  metricType: "mentions",
  startTime: Date.now() - 7 * 86400000,
  endTime: Date.now(),
  maxDataPoints: 100,
})

// Distribution by source
client.entityMetrics.getDistribution("AAPL", "sentiment")
client.entityMetrics.getDistribution("AAPL", "mentions", { dimension: "source" })
```

Available metric types: `mentions`, `sentiment`, `sentisense`, `social_dominance`, `creators`.

### Knowledge Base

```typescript
client.kb.getPopularEntities()
client.kb.getEntity("entity-id")
client.kb.getAllEntities()
```

### Analyst Ratings

The **price target cone** (mean, high, low, upside %) and consensus are **free for everyone, full data via API**: we give it away. Upgrade/downgrade feeds and forward EPS estimates are limited on free, unlimited on PRO.

```typescript
client.analyst.consensus("AAPL")                        // Price target cone + consensus. Free for everyone, full data.
client.analyst.actions("AAPL", { lookbackDays: 30 })    // Upgrade/downgrade feed. Free: 3 most recent. PRO: unlimited.
client.analyst.estimates("AAPL")                        // Forward EPS + earnings surprises. Free: 1 quarter. PRO: full history.
client.analyst.marketActivity({ lookbackDays: 7 })      // Market-wide analyst actions (PRO).
```

### Company KPIs (PRO)

```typescript
client.stocks.getKpis("AAPL")       // Product metrics and segment revenue time-series. Free returns metadata only (empty kpis array); PRO returns full series.
client.stocks.listKpiCoverage()     // All tickers with curated KPI data (free, no quota cost)
```

### ETFs (beta)

Composition data is public; the holdings-weighted aggregate views follow the same PRO-with-preview pattern as Analyst/Insider. Aggregates synthesize fund-level views from each constituent's per-stock data, weighted by allocation, with a `coverage` block on every response.

```typescript
client.etfs.list()                                              // Every ETF tracked. Returns ticker, name, issuer, tracked index, asset class.
client.etfs.holdings("QQQ")                                     // Full composition: per-holding weights + freshness metadata.
client.etfs.analystAggregate("QQQ")                             // Holdings-weighted analyst consensus. Free: headline + coverage. PRO: + topContributors.
client.etfs.insiderAggregate("ARKK", { lookbackDays: 90 })      // Holdings-weighted Form 4 net flow. Free: headline. PRO: + topContributors.
client.etfs.sentimentAggregate("QQQ")                           // SentiSense readings side-by-side: constituent-weighted vs direct.
```

### Market Mood

```typescript
client.marketMood.get()
```

## Error Handling

```typescript
import SentiSense, { AuthenticationError, RateLimitError } from "sentisense";

try {
  const summary = await client.stocks.getAISummary("AAPL");
} catch (error) {
  if (error instanceof AuthenticationError) {
    // 401 or 403: invalid/missing API key or insufficient tier
  } else if (error instanceof RateLimitError) {
    // 429: quota exceeded
  }
}
```

| Error Class | HTTP Status | When |
|------------|-------------|------|
| `AuthenticationError` | 401, 403 | Invalid API key or insufficient tier |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Quota exceeded |
| `APIError` | Other 4xx/5xx | General API error |

All errors extend `SentiSenseError` and include `status`, `code`, and `message` properties.

## Configuration

```typescript
const client = new SentiSense({
  apiKey: "ss_live_YOUR_KEY",  // Get yours at app.sentisense.ai/settings/developer
  baseUrl: "https://...",      // Default: https://app.sentisense.ai
  timeout: 30000,              // Default: 30s (in milliseconds)
});
```

## Get an API Key

Generate your API key from the [Developer Console](https://app.sentisense.ai/settings/developer).

For full API documentation, see [sentisense.ai/docs/api](https://sentisense.ai/docs/api).

## License

MIT
