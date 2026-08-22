# sentisense

[![npm version](https://img.shields.io/npm/v/sentisense.svg)](https://www.npmjs.com/package/sentisense)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK and CLI for the [SentiSense](https://sentisense.ai) market intelligence API: stock prices, news and social sentiment, the SentiSense Score, insider and congressional trading, institutional 13F flows, options positioning, analyst ratings, earnings analysis, and a cross-signal screener.

- Full TypeScript support with detailed type definitions
- Works in Node.js 18+, Deno, Bun, and browsers
- Zero runtime dependencies (native `fetch`)
- Namespaced resources (`stocks`, `documents`, `institutional`, ...) and a typed error hierarchy
- A complete command line interface in the same package, runnable via `npx` with nothing to install

Get a free API key at [app.sentisense.ai/get-api-key](https://app.sentisense.ai/get-api-key). Full API docs at [sentisense.ai/docs/api](https://sentisense.ai/docs/api).

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [The CLI](#the-cli)
- [Configuration](#configuration)
- [Response shapes](#response-shapes)
- [API reference](#api-reference)
- [Error handling](#error-handling)

## Install

```bash
npm install sentisense
```

## Quick start

```typescript
import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

const price = await client.stocks.getPrice("AAPL");
console.log(price.currentPrice);

// reportDate is optional; omit it to get the latest available quarter
// (this one returns a wrapper: see "Response shapes" below)
const flows = await client.institutional.getFlows();
```

## The CLI

The same package ships a command line tool. Nothing to install:

```bash
npx -y sentisense@latest quote NVDA
```

Every endpoint needs a key, so set one first. Either works:

```bash
export SENTISENSE_API_KEY=<your key>
# or store it once, owner-readable only, at ~/.config/sentisense/config.json
npx -y sentisense@latest auth <your key>

npx -y sentisense@latest health
```

### Commands

| Command | What you get |
|---------|--------------|
| `auth [key]` | Store a key, show what is configured, or `--remove` it |
| `health` | Reachability, key validity, latency, and the resolved base URL |
| `quote <ticker>...` | Price, day range, 52-week range, market cap, P/E. One request per ticker |
| `sentiment <ticker>` | SentiSense Score, tone, attention, per-source breakdown, `--days N` history |
| `mood` | Composite market sentiment, the signals behind it, and the sector map |
| `analysts <ticker>` | Consensus, price target band, recent upgrades and downgrades |
| `earnings [ticker]` | Forward calendar with no ticker, per-quarter analysis with one (`earnings AAPL`) |
| `insiders <ticker>` | Filed Form 4 transactions, including whether they were pre-planned |
| `insights <ticker>` | Generated signals, filterable by `--urgency` and `--type` |
| `congress [ticker]` | Congressional disclosures, market-wide or for one symbol |
| `news [ticker]` | Clustered news stories with impact and tone |
| `flows [ticker]` | Institutional 13F flows, or one ticker's holders and notable changes |
| `options <ticker>` | End-of-day options positioning, IV rank, walls, unusual contracts |
| `screen --filter ...` | Screen the universe on Score, analyst, technical, and price fields |

Run `sentisense help <command>` for its flags and examples.

### Output modes

Readable in a terminal, plain text when piped, and exact API JSON on request:

```bash
npx -y sentisense@latest quote NVDA              # terminal layout
npx -y sentisense@latest quote NVDA | cat        # plain text, no escape codes
npx -y sentisense@latest quote NVDA --json | jq  # the API response untouched
```

`--json` prints what the API returned, envelope and all, so `isPreview` and `totalCount` stay visible. For `quote` that is the exact quote response for one ticker, and an object keyed by ticker for several. `--full` widens any command. `--no-color` and `NO_COLOR` drop the colour, `--plain` and `--pretty` force a layout, and `--debug` prints stack traces.

Commands spend requests on the answer, not on decoration: `quote` looks up the company name only for the terminal layout, so piped and `--json` output cost one request per ticker. When something supplementary does not come back, such as the Score history behind a sparkline, the command still prints its answer and exits 0 with a `note:` line on stderr, so stdout stays clean for a pipe and the gap is never silent.

### Exit codes

Failures print two lines to stderr, what went wrong and what to do about it, and exit with a code you can branch on. The CLI does not retry, so a 5 is yours to handle.

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | API error or unexpected failure |
| 2 | Bad usage: unknown command, flag, or missing argument |
| 3 | Missing or rejected API key |
| 4 | No data for that symbol or identifier |
| 5 | Rate limited |
| 6 | Network failure or timeout |

### Saying who is calling

If you set `SENTISENSE_AGENT_NAME` (what your agent is called) and `SENTISENSE_SKILL` (the slug of the skill driving it), requests carry that identity, so usage can be understood and the tools improved. Both are optional, never required, and nothing is inferred when they are absent.

```bash
export SENTISENSE_AGENT_NAME=research-desk
export SENTISENSE_SKILL=us-stocks-analysis
npx -y sentisense@latest quote NVDA
# User-Agent: sentisense-node/{version} sentisense-cli/{version} (us-stocks-analysis; agent/research-desk)
```

Either can also be a flag (`--agent`, `--skill`) or a stored setting (`sentisense auth --agent research-desk --skill us-stocks-analysis`), resolved flag first, then environment, then config. Values are reduced to letters, digits, dot, underscore and hyphen, and capped at 32 characters, so nothing you set can reshape the header.

Research data, not investment advice.

## Configuration

```typescript
const client = new SentiSense({
  apiKey: process.env.SENTISENSE_API_KEY,  // Get yours at app.sentisense.ai/get-api-key
  baseUrl: "https://...",                  // Default: https://app.sentisense.ai
  timeout: 30000,                          // Default: 30s (in milliseconds)
  maxRetries: 3,                           // Default: 3
  userAgentSuffix: "my-bot/1.4",           // Default: none
});
```

| Option | Default | What it does |
|--------|---------|--------------|
| `apiKey` | none | Sent as `X-SentiSense-API-Key`. Required by every endpoint. |
| `baseUrl` | `https://app.sentisense.ai` | Override for a non-production host. |
| `timeout` | `30000` | Per-request timeout in milliseconds. |
| `maxRetries` | `3` | Retries on 429 and 5xx, honouring `Retry-After`. Set `0` to fail fast. |
| `userAgentSuffix` | none | Appended to the User-Agent, after `sentisense-node/{version}`. |

`userAgentSuffix` is how you say what is calling on top of the SDK, so your traffic is legible in your own logs and in ours. A tool name and version works (`"my-bot/1.4"`), optionally with an agent label (`"my-bot/1.4 agent/research-desk"`). Node only, since browsers set the header themselves. Newlines are collapsed and an empty value is ignored.

Keep the key in the environment rather than in source. Committing a literal key leaks it into git history and into every registry security scan that reads your repo.

## Response shapes

Most methods resolve to the payload directly, but two families wrap it. The return types describe the wrapper, so `.data` / `.documents` type-check natively, no cast.

**1. Tier-gated endpoints return a preview envelope.** The payload is in `data`, and `isPreview` tells you whether it was truncated for your tier. `totalCount` carries the untruncated size whenever the server knows it: on a truncated response, so you can render "showing N of M", and on a paged endpoint such as `politicians.getActivity`, where it is the full match count on every tier including PRO. A missing `totalCount` means "count `data` yourself", never "zero results".

Affected: `institutional.getFlows` / `getHolders` / `getActivists`, and all five `insights` methods.

```typescript
const flows = await client.institutional.getFlows();
if (flows.isPreview) {
  console.log(`Preview: ${flows.data.inflows.length} of ${flows.totalCount}`);
}
for (const flow of flows.data.inflows) {
  console.log(flow.ticker, flow.netSharesChange);
}

// holders nest one level deeper: ticker-level totals plus the rows
const holders = await client.institutional.getHolders("AAPL", "2026-06-30");
console.log(`${holders.data.holderCount} holders`);
const newPositions = holders.data.holders.filter((h) => h.changeType === "NEW");

// insights use the same envelope, wrapping a plain array
const insights = await client.insights.stock("AAPL");
for (const insight of insights.data) {
  console.log(insight.insightText);
}
```

**2. Document endpoints return a search wrapper.** This is not the preview envelope: the rows are in `documents` and there is no `isPreview`.

Affected: `documents.getByTicker` / `getByTickerRange` / `getByEntity` / `search` / `getBySource`. Also `stocks.getFundamentalsPeriods`, whose periods are in `periods`.

```typescript
const results = await client.documents.search("NVDA earnings", { days: 7 });
console.log(`${results.totalCount} matches`);
for (const doc of results.documents) {
  console.log(doc.url, doc.averageSentiment);
}
```

Everything else, including `stocks.getPrice()`, `documents.getStories()`, `insights.types()` and `institutional.getQuarters()`, resolves to the value itself with no wrapper.

> **Upgrading from 0.28.x or earlier?** These return types were corrected in 0.29.0. If your code read the flat shape (`flows.inflows`, `holders.filter(...)`), it was returning `undefined` / throwing at runtime already; switch to `flows.data.inflows` / `holders.data.holders`. See [CHANGELOG.md](./CHANGELOG.md) for the full mapping.

## API reference

### Stocks

```typescript
client.stocks.list()                                    // All ticker symbols
client.stocks.listDetailed()                            // All stocks with details
client.stocks.getPrice("AAPL")                          // Latest price
client.stocks.getPrices(["AAPL", "NVDA"])               // Batch prices
client.stocks.getQuote("AAPL")                          // Fuller quote: ranges, market cap, P/E
client.stocks.getProfile("AAPL")                        // Company profile
client.stocks.getChart("AAPL", { timeframe: "6M" })     // OHLCV chart data
client.stocks.getMarketStatus()                         // Market open/closed
client.stocks.getFundamentals("AAPL")                   // Financial data
client.stocks.getShortInterest("GME")                   // Short interest
client.stocks.getOptionsSummary("NVDA")                 // End-of-day options dossier
client.stocks.getOptionsHistory("NVDA", { window: "2y" })  // Daily options aggregates over time
client.stocks.getAISummary("AAPL", { depth: "deep" })   // AI report (PRO)
```

Price fields carry `priceAsOf` (Unix milliseconds) for the age of the market data; read that for freshness rather than `timestamp`, which is when the response was served.

### Documents & news

```typescript
client.documents.getByTicker("AAPL", { source: "news", days: 3 })
client.documents.search("NVDA earnings", { days: 7, limit: 20 })
client.documents.getStories({ limit: 10 })
client.documents.getStoryDetail("cluster_abc123")
```

### Institutional flows (13F)

```typescript
client.institutional.getQuarters()
client.institutional.getFlows("2025-02-14", { limit: 20 })
client.institutional.getHolders("AAPL", "2025-02-14")
client.institutional.getActivists("2025-02-14")
```

**Paging the holder list.** A widely held ticker returns thousands of rows: a megacap quarter is roughly 6,000 holders and 1.5 MB on the wire. Pass `limit` unless you really want the whole list; omitting the options object sends the original unbounded request, so existing code keeps working.

| Option | Values |
|--------|--------|
| `limit` | Maximum rows to return. Must be >= 1; values above 1000 are capped server-side. Omit for the full list. |
| `offset` | Row offset to start from. Server default is 0. Requires `limit`. |
| `sortBy` | `"shares"` (server default), `"valueUsd"`, or `"sharesChangePct"`. Requires `limit`. |
| `sortDir` | `"desc"` (server default) or `"asc"`. Requires `limit`. |

`limit` is the switch for the whole set: send `offset`, `sortBy`, or `sortDir` without it and the server ignores them, returning the full unsorted list with a 200 and no warning.

```typescript
// Top 10 holders by position value, largest first
const top = await client.institutional.getHolders("AAPL", "2026-03-31", {
  limit: 10,
  sortBy: "valueUsd",
  sortDir: "desc",
});
for (const holder of top.data.holders) {
  console.log(holder.filerName, holder.valueUsd);
}

// Walk the list a page at a time
const page = await client.institutional.getHolders("AAPL", "2026-03-31", {
  limit: 100,
  offset: 100,
});
console.log(`${page.data.holders.length} rows of ${page.data.holderCount}`);
```

A response to a request carrying `limit` also has three fields the unbounded response does not: `returnedCount` (rows on this page, smaller than your `limit` on the last one), `offset` (echoed back), and `notableChanges`, a ticker-wide summary of the quarter's biggest position moves so you do not have to scan every page to find them. Each holder row also carries `entitySlug`, which you can hand straight to `institutional.getInstitutionDetail()`, and `cikCount` when the row rolls up several SEC filers under one manager; both are null for filers not matched to an institution page, so check before building a link.

### Congressional trading

```typescript
client.politicians.getActivity({ lookbackDays: 90 })  // Market-wide STOCK Act feed
client.politicians.getFilings("NVDA")                 // Trades in one stock
client.politicians.getMembers()                       // Tracked members + trade stats
client.politicians.getMember("nancy-pelosi")          // One member's profile and trades
client.politicians.getDirectory({ q: "tex" })         // Discover slugs, including former members
```

**Paging the activity feed.** A 90-day window is routinely well over a thousand disclosures, and without `limit` the server returns the first 200 with nothing in the payload to say it stopped. `totalCount` on the envelope is the real size on every tier, so size the walk from that rather than from `data.length`.

| Option | Values |
|--------|--------|
| `lookbackDays` | Days to look back (1-365). Defaults to 90. |
| `limit` | Rows to return. Must be >= 1; anything above 500 is capped at 500. Omit for the default 200. |
| `offset` | Row offset to start from. Defaults to 0. Works with or without `limit`. |

```typescript
const first = await client.politicians.getActivity({ limit: 100 });
console.log(`${first.data.length} of ${first.totalCount} disclosures`);

for (let offset = 100; offset < (first.totalCount ?? 0); offset += 100) {
  const page = await client.politicians.getActivity({ limit: 100, offset });
  for (const trade of page.data) {
    console.log(trade.politicianName, trade.ticker, trade.transactionType);
  }
}
```

### Insider trading (Form 4)

```typescript
client.insider.getActivity({ lookbackDays: 30 })   // Market-wide buys and sells by ticker
client.insider.getTrades("NVDA", { lookbackDays: 90 })  // Individual filed transactions
client.insider.getClusterBuys({ lookbackDays: 90 })     // 3+ distinct insiders buying the same stock
```

Each trade row carries both the raw SEC `transactionCode` and a simplified `transactionType`. Only codes `P` and `S` are open-market trades; awards, gifts, exercises, and code `F` (shares withheld to cover taxes at vest, served as `SELL`) are corporate mechanics, so read `transactionCode` when you tally discretionary buying or selling. The market-wide activity endpoint's sells already exclude code `F` server-side.

### Analyst ratings

The price target cone (mean, high, low, upside %) and consensus are free for everyone with full data. Upgrade/downgrade feeds and forward EPS estimates are limited on free, unlimited on PRO.

```typescript
client.analyst.consensus("AAPL")                        // Price target cone + consensus. Free, full data.
client.analyst.actions("AAPL", { lookbackDays: 30 })    // Upgrade/downgrade feed. Free: 3 most recent.
client.analyst.estimates("AAPL")                        // Forward EPS + surprises. Free: 1 quarter.
client.analyst.marketActivity({ lookbackDays: 7 })      // Market-wide analyst actions (PRO).
```

### Earnings

The earnings analysis report is the assembled version of a quarter: one object per fiscal period carrying the editorial headline, the KPI cards with year-over-year deltas, the guidance language as management phrased it, and a summary of the earnings call. Pair it with the recent-reporters feed to drive a post-earnings sweep. Both return the preview envelope.

```typescript
client.earnings.getSummaries("AAPL", { limit: 4 })   // Per-quarter analysis, newest first. Free: latest quarter, shaped.
client.earnings.getRecent({ days: 7, limit: 25 })    // Who reported in the last N days. Full window on every key.
```

```typescript
const res = await client.earnings.getSummaries("AAPL", { limit: 1 });
const quarter = res.data[0];

if (quarter) {
  console.log(quarter.fiscalPeriod, quarter.reportDate);
  console.log(quarter.headline);
  for (const kpi of quarter.kpiHighlights ?? []) {
    console.log(`  ${kpi.label}: ${kpi.value} (${kpi.yoy ?? "no YoY"})`);
  }

  if (res.isPreview) {
    // Free key: section titles stand in for the bodies.
    console.log("Summary covers:", quarter.summaryTopics?.join(", "));
  } else {
    console.log(quarter.summaryMd);
  }
}
```

The forward-looking half of the family is `client.calendar.getEarnings()`, which covers scheduled dates and consensus EPS rather than results.

### Company KPIs (PRO)

```typescript
client.stocks.getKpis("AAPL")       // Product metrics and segment revenue. Free: metadata only. PRO: full series.
client.stocks.listKpiCoverage()     // All tickers with curated KPI data (free, no quota cost)
```

### ETFs (beta)

Composition data is public; the holdings-weighted aggregate views follow the same PRO-with-preview pattern as analyst and insider data. Aggregates synthesize fund-level views from each constituent's per-stock data, weighted by allocation, with a `coverage` block on every response.

```typescript
client.etfs.list()                                              // Every ETF tracked
client.etfs.holdings("QQQ")                                     // Full composition + freshness metadata
client.etfs.analystAggregate("QQQ")                             // Holdings-weighted analyst consensus
client.etfs.insiderAggregate("ARKK", { lookbackDays: 90 })      // Holdings-weighted Form 4 net flow
client.etfs.sentimentAggregate("QQQ")                           // Constituent-weighted vs direct Score
```

### Entity metrics

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

### Options

End-of-day options positioning: where implied volatility, put/call flow and skew are unusual today, and how a name's readings have trended.

```typescript
client.options.getOverview()                            // Market-wide radar, ranked
client.stocks.getOptionsSummary("NVDA")                 // One name's full dossier
client.stocks.getOptionsHistory("NVDA", { window: "2y" })  // That name's daily series
```

The radar carries two separately-ranked boards: `data.rows` for stocks and `data.etfRows` for ETFs. Keep them apart. Every reading behind a row's `interestScore` is a percentile of that ticker's own trailing history, so a ranking built across both boards compares numbers measured against different baselines. The aggregates split the same way, with the `etf`-prefixed fields describing the ETF board alone.

A row whose baseline is still building carries its raw readings with the percentiles and `interestScore` omitted, which means "not enough history yet" rather than "nothing interesting". `getOptionsSummary` reports an uncovered ticker as a `null` payload; `getOptionsHistory` reports it as an empty `series` instead, so check the array rather than null-checking there.

### Market mood & knowledge base

```typescript
client.marketMood.get()             // Composite market sentiment with sub-signals
client.kb.getPopularEntities()      // Most-tracked entities
```

### Screener

Filter the tracked universe on the SentiSense Score, attention, analyst consensus, technicals and price in one query. Screening on analyst ratings alone is something a dozen free tools do; screening on analyst ratings *where the Score disagrees* is not.

```typescript
client.screener.fields()                      // Every filterable field, both universes, with units + operators
client.screener.screens()                     // The curated screens shipped in the product, each with a runnable plan
client.screener.run({ plan, tickers, limit }) // Run a screen against the stock universe
client.screener.runEtfs({ plan, limit })      // Run a screen against the ETF universe
```

```typescript
// Run a curated screen as-is
const { screens } = await client.screener.screens();
const crowdVsStreet = screens.find((s) => s.id === "crowd-vs-street")!;
const curated = await client.screener.run({ plan: crowdVsStreet.plan, limit: 25 });
console.log(`${curated.matched} matched, showing ${curated.results.length}`);

// Or build your own: bullish Score, thin analyst enthusiasm
const res = await client.screener.run({
  plan: {
    filters: [
      { fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 },
      { fieldName: "ANALYST_BUY_RATIO_PCT", op: "LTE", value: 30 },
      { fieldName: "ANALYST_COUNT", op: "GTE", value: 5 },
    ],
    sort: { fieldName: "SENTI_SCORE_7D", dir: "DESC" },
  },
  limit: 25,
});
for (const row of res.results) {
  console.log(row.ticker, row.sentiSenseScore7D, row.analystBuyRatioPct);
}
```

`limit` rides next to the plan rather than inside it, because a plan is a stored object and paging is a transport concern. It defaults to 100 and caps at 500. `matched` is the count before `limit` was applied, so truncation is visible. `tickers` is optional: omit it to screen the whole tracked universe, pass a list to screen a watchlist.

Three field semantics are worth stating outright, because guessing them wrong produces a screen that looks fine and means nothing:

- **`ANALYST_RATING_MEAN` is inverted.** It is the vendor's 1-to-5 scale where **1.0 is strong buy**, so bullish is `LTE 2.5`. Prefer `ANALYST_BUY_RATIO_PCT`, which runs the intuitive direction.
- **`MA_CROSS_STATE` is ordinal**, not a percentage: `1` golden cross, `-1` death cross, `0` neither. Use `EQ`.
- **`SENTIMENT_DIRECTION` is the sign of the 7-day SentiSense Score** (`1` / `0` / `-1`) with a neutral band of plus-or-minus 5. Despite the name it is not sentiment polarity.

The Score fields (`SENTI_SCORE_7D`, `SENTI_SCORE_1M`, `SCORE_CHANGE_7D`) are the SentiSense Score, not polarity: unbounded, banded at 5 / 13 / 23 either side of zero. Filter on those band edges, not on values like `0.5`, which behave as "any positive score". Nulls never match in either direction, so `RETURN_1Y >= 0` and `RETURN_1Y < 0` do not partition the universe: a stock listed four months ago is in neither result. If a screen returns fewer rows than you expect, check coverage before you check your thresholds.

On the ETF side, `CONSTITUENTS_WEIGHTED_SENTISENSE` is the holdings-weighted Score across what the fund owns and is usually the one you want; `DIRECT_SENTISENSE` is the Score from chatter about the fund ticker itself. `WEIGHT_COVERED_PCT` tells you how much of the fund's weight had constituent data behind the weighted number.

Screens read a snapshot that refreshes every 20 minutes, so this is not a quote feed. Use `client.stocks.getQuote()` for current quotes.

## Error handling

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

| Error class | HTTP status | When |
|------------|-------------|------|
| `AuthenticationError` | 401, 403 | Invalid API key or insufficient tier |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Quota exceeded |
| `APIError` | Other 4xx/5xx | General API error |

All errors extend `SentiSenseError` and include `status`, `code`, and `message` properties.

## Links

- Get a free API key: [app.sentisense.ai/get-api-key](https://app.sentisense.ai/get-api-key)
- API documentation: [sentisense.ai/docs/api](https://sentisense.ai/docs/api)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

SentiSense provides research data for informational and educational purposes, not investment advice.

## License

MIT
