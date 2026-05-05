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

// Public endpoints work without an API key
const client = new SentiSense();
const price = await client.stocks.getPrice("AAPL");
console.log(price);

// Use an API key for authenticated endpoints
const authed = new SentiSense({ apiKey: "ssk_YOUR_KEY" });
const flows = await authed.institutional.getFlows("2025-02-14");
```

## Features

- Full TypeScript support with detailed type definitions
- Works in Node.js 18+, Deno, Bun, and browsers
- Zero runtime dependencies (uses native `fetch`)
- Namespaced API resources (stocks, documents, institutional, etc.)
- Typed error hierarchy for clean error handling

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
client.documents.getStories({ limit: 10, expanded: true })
client.documents.getStory("cluster_abc123")
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

Available metric types: `mentions`, `sentiment`, `sentisense_score`, `social_dominance`, `creators`.

### Knowledge Base

```typescript
client.kb.getPopularEntities()
client.kb.getEntity("entity-id")
client.kb.getAllEntities()
```

### Analyst Ratings

The **price target cone** (mean, high, low, upside %) and consensus are **free for everyone, full data via API** — we give it away. Upgrade/downgrade feeds and forward EPS estimates are limited on free, unlimited on PRO.

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
    // 401 or 403 — invalid/missing API key or insufficient tier
  } else if (error instanceof RateLimitError) {
    // 429 — quota exceeded
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
  apiKey: "ssk_YOUR_KEY",     // Optional for public endpoints
  baseUrl: "https://...",      // Default: https://app.sentisense.ai
  timeout: 30000,              // Default: 30s (in milliseconds)
});
```

## Get an API Key

Generate your API key from the [Developer Console](https://app.sentisense.ai/settings/developer).

For full API documentation, see [sentisense.ai/docs/api](https://sentisense.ai/docs/api).

## License

MIT
