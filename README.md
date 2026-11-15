# sentisense

[![npm version](https://img.shields.io/npm/v/sentisense.svg)](https://www.npmjs.com/package/sentisense)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The official JavaScript and TypeScript client for the [SentiSense](https://sentisense.ai) API, plus a command line tool in the same package. It covers prices and fundamentals, news and social sentiment, the SentiSense Score and Rating, insider and congressional trades, 13F holdings, analyst ratings, earnings, options positioning, ETFs and a screener that mixes all of them.

It ships its own types and has no runtime dependencies. It runs on Node 18+, Deno, Bun and the browser.

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

You need an API key. The free one at [app.sentisense.ai/get-api-key](https://app.sentisense.ai/get-api-key) works with every endpoint, or run `npx sentisense init` for a temporary key without signing up.

## Quick start

```typescript
import SentiSense from "sentisense";

const client = new SentiSense(); // reads SENTISENSE_API_KEY, or pass { apiKey }

const tickers = await client.stocks.list();
console.log(tickers.length, "stocks covered");

const price = await client.stocks.getPrice("NVDA");
console.log(price.currentPrice, price.changePercent);

const score = await client.entityMetrics.getMetrics("NVDA", { metricType: "sentisense_score" });
console.log("SentiSense Score:", score.at(-1)?.value);

for (const story of await client.documents.getStoriesByTicker("NVDA", { limit: 3 })) {
  console.log(story.cluster.title);
}

const trades = await client.insider.getTrades("NVDA");
for (const trade of trades.data.slice(0, 5)) {
  console.log(trade.insiderName, trade.transactionCode, trade.sharesTransacted);
}
```

## The CLI

Try the API without writing code:

```bash
export SENTISENSE_API_KEY=<your key>     # or: npx -y sentisense@latest auth <your key>
npx -y sentisense@latest quote NVDA
npx -y sentisense@latest health          # checks your key and the connection
```

| Command | What you get |
|---------|--------------|
| `auth [key]` | Store a key, show what's configured, or `--remove` it |
| `init` | A temporary key with no signup, and a link to keep it |
| `health` | Whether the API is reachable and your key works |
| `quote <ticker>...` | Price, day and 52-week range, market cap, P/E |
| `sentiment <ticker>` | SentiSense Score, tone, attention and the split by source |
| `mood` | Market Mood and the sector map |
| `analysts <ticker>` | Consensus, price targets, recent upgrades and downgrades. `--coverage` lists who covers it |
| `analyst <slug>` | One analyst's firms and coverage. `--calls` for their notes |
| `earnings [ticker]` | The calendar, or one company's quarters |
| `kpis <ticker>` | Company KPIs from earnings filings |
| `insiders <ticker>` | Form 4 trades, including whether they were pre-planned |
| `insights <ticker>` | Signals for a stock |
| `congress [ticker]` | Trades disclosed by members of Congress |
| `news [ticker]` | Stories with impact and tone |
| `flows [ticker]` | 13F flows, or one stock's holders |
| `options <ticker>` | End-of-day options positioning. `--intraday` for the latest session's 15-minute series (PRO) |
| `screen --filter ...` | Screen stocks on Score, analysts, technicals, price and options |
| `search <name>` | Turn a name into a ticker and entity slug |

`sentisense help <command>` shows the flags and examples for each one.

**A key with no signup.** `npx -y sentisense@latest init` prints `SENTISENSE_API_KEY=<key>` and a command to try it with. The key is temporary and rate-limited. To keep it, open the link it prints and sign in or create a free account; the same key then stays yours. `init` writes nothing into your project, and if a key is already configured it says so instead of making a new one. To tell apart machines that share a network, `init` sends a random id and stores it as `install-id` in the CLI's config directory (`~/.config/sentisense`). It is not derived from you or your machine.

**Output.** Commands print a readable layout in a terminal and plain text when piped. `--json` prints the API's JSON, under one key per call when a command makes several, so `isPreview` and `totalCount` are still there for `jq`. `--full` shows every column. In `quote NVDA ZZZZQ AAPL`, a ticker that fails is named on stderr and the rest still print, with that ticker's exit code.

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | API error or unexpected failure |
| 2 | Bad usage: unknown command, flag, or missing argument |
| 3 | Missing or rejected API key |
| 4 | No data for that symbol or identifier |
| 5 | Rate limited, or the monthly allowance is used up (the CLI doesn't retry) |
| 6 | Network failure or timeout |

If an agent drives the CLI, set `SENTISENSE_AGENT_NAME` and `SENTISENSE_SKILL` (or pass `--agent` and `--skill`) and requests carry them in the User-Agent.

## Configuration

```typescript
const client = new SentiSense({ timeout: 30000, maxRetries: 3 });
```

| Option | Default | What it does |
|--------|---------|--------------|
| `apiKey` | `SENTISENSE_API_KEY` | Your key, sent as the `X-SentiSense-API-Key` header |
| `baseUrl` | `https://app.sentisense.ai` | Change it only to point at another host |
| `timeout` | `30000` | Milliseconds per request |
| `maxRetries` | `3` | Retries for the per-minute 429 and server errors. Set `0` to handle them yourself |
| `userAgentSuffix` | none | Added to the User-Agent, such as `"my-bot/1.4"`, so your traffic is easy to spot in logs (Node only) |

Keep the key in the environment rather than in your code, so it never lands in git.

## Response shapes

Most methods resolve to the data itself. Two kinds of response wrap it, and the return types say which, so `.data` and `.documents` type-check without a cast.

**1. Tier-gated endpoints return a preview envelope.** The payload is in `data`. `isPreview` says whether your plan got a shortened version, and `totalCount` is the full size when the server knows it. These are the methods that return it:

| Namespace | Methods |
|-----------|---------|
| `analyst` | `consensus` `consensusHistory` `calledIt` `actions` `estimates` `marketActivity` `coverage` `profile` `calls` |
| `calendar` | `getEarnings` |
| `earnings` | `getSummaries` `getRecent` `getStatistics` `getRanked` |
| `etfs` | `analystAggregate` `insiderAggregate` `sentimentAggregate` |
| `insider` | `getActivity` `getTrades` `getClusterBuys` |
| `insights` | `stock` `stockRange` `market` `latest` `user` |
| `institutional` | `getFlows` `getHolders` `getHoldersHistory` `getInstitutionHistory` `getActivists` |
| `options` | `getOverview` |
| `politicians` | `getActivity` `getFilings` `getMembers` `getMember` |
| `stocks` | `getSentiment` `getKpis` `getOptionsSummary` `getOptionsHistory` `getOptionsIntradayHistory` |

```typescript
const flows = await client.institutional.getFlows();
if (flows.isPreview) console.log(`Preview: ${flows.data.inflows.length} of ${flows.totalCount}`);
for (const flow of flows.data.inflows) console.log(flow.ticker, flow.netSharesChange);
```

The envelope is always an object, so test `data`, not the response. `data` can be `null` on three of them: `stocks.getOptionsSummary` for an uncovered ticker, `options.getOverview` before its first nightly build, and `stocks.getOptionsIntradayHistory` on a free key.

**2. Document endpoints return a search wrapper.** The rows are in `documents`, next to `totalCount`, with no preview flag. That covers `documents.getByTicker`, `getByTickerRange`, `getByEntity`, `search` and `getBySource`. `stocks.getFundamentalsPeriods` puts its rows in `periods`.

[Using the Python and Node SDKs](https://sentisense.ai/docs/support/using-the-python-and-node-sdks/) covers previews, paging, retries and errors for both SDKs.

## API reference

Each section lists the calls and links to the API docs page that explains every field.

### Stocks

```typescript
client.stocks.list()                                       // every ticker we cover
client.stocks.listDetailed()                               // the same, with names and entity ids
client.stocks.listPopular()                                // the most-followed tickers
client.stocks.getPrice("AAPL")                             // latest price, delayed 15 minutes
client.stocks.getPrices(["AAPL", "NVDA"])                  // several at once
client.stocks.getQuote("AAPL")                             // day range, 52-week range, market cap, P/E
client.stocks.getProfile("AAPL")                           // company profile
client.stocks.getChart("AAPL", { timeframe: "6M" })        // price bars
client.stocks.getMarketStatus()                            // is the market open
client.stocks.getSimilar("AAPL")                           // peers
client.stocks.getEtfs("NVDA", { limit: 5 })                // ETFs that hold it, heaviest weight first
client.stocks.getGraph("AAPL", { depth: 1 })               // people, products and peers
client.stocks.getEntities("AAPL")                          // entities linked to the stock
client.stocks.getAISummary("AAPL", { depth: "deep" })      // our research report
client.stocks.getFundamentals("AAPL")                      // statements, as filed
client.stocks.getFundamentalsHistory("AAPL", { timeframe: "annual" })  // up to 40 quarters or 20 years
client.stocks.getCurrentFundamentals("AAPL")               // the latest snapshot
client.stocks.getShortInterest("GME", { limit: 12 })       // short interest by settlement date
client.stocks.getShortVolume("GME")                        // daily short volume
client.stocks.getFloat("GME")                              // shares available to trade
client.stocks.getImages(["AAPL"])                          // logos
client.stocks.getDescriptions(["AAPL"])                    // short company descriptions
```

For a fund, use `etfs.quote()`. `getQuote` accepts a fund ticker but leaves out AUM, NAV and expense ratio, and its `seeInstead` points at the fund quote. Only the `10Y` and `MAX` charts are dividend-adjusted. Statement figures are in the company's own currency (`reportedCurrency`); a period served from an SEC-backed record says which lines came from the filing in `source` and `lineSources`. [Stocks API docs](https://sentisense.ai/docs/api/stocks/)

### Documents & news

```typescript
client.documents.getByTicker("AAPL", { source: "news", days: 3 })   // news and social posts about a stock
client.documents.search("NVDA earnings", { days: 7, limit: 20 })      // plain-language search
client.documents.getStories({ limit: 10 })                           // today's stories
client.documents.getStoriesByTicker("AAPL", { limit: 5 })            // stories about one stock
client.documents.searchStories({ query: "fed decision", days: 30 })   // search stories
client.documents.getStoryDetail("cluster_abc123")                    // one story in full
client.marketSummary.get()                                           // our written market summary
```

Documents carry sentiment, entities and a link, not the article text. `getStoryDetail` returns `unknown`, so narrow it yourself; `StoryTimelineEntry` types its `timeline`. [Documents API docs](https://sentisense.ai/docs/api/documents/)

### Entity metrics

```typescript
client.entityMetrics.getMetrics("AAPL", { metricType: "sentiment" })          // one metric over time
client.entityMetrics.getMetrics("AAPL", { metricType: "mentions", startTime: Date.now() - 7 * 86400000 })
client.entityMetrics.getDistribution("AAPL", "mentions", { dimension: "source" })  // share of mentions by source, valueType "SHARE_PERCENT"
client.entityMetrics.getDistribution("AAPL", "sentiment")                       // mean sentiment by source, valueType "MEAN"
client.stocks.getSentiment("AAPL")                                             // Score, mentions, tone by source
```

Available metric types: `mentions`, `sentiment`, `sentisense_score`, `sentisense_rating`, `social_dominance`, `creators`, `app_review_count`, `app_rating`, `app_all_ratings_count`, `app_all_ratings_avg`. The `app_` ones take a product slug such as `"Instagram"`, not a ticker.

Sentiment runs from -1 to 1. The SentiSense Score is sentiment weighted by attention and has no fixed range. Each point's reading is in `value`. `startTime` and `endTime` are epoch milliseconds. [Metrics API docs](https://sentisense.ai/docs/api/metrics/)

### SentiSense Rating

```typescript
const rating = await client.stocks.getRating("AAPL");
if (rating.rated) {
  console.log(rating.letter, rating.score, "percentile", rating.percentile);
} else {
  console.log("no grade today:", rating.reason);
}
```

`rated` narrows the type, so check it first: an unrated stock comes back as a normal response. Each response carries a `disclaimer` to show next to the grade. [Rating API docs](https://sentisense.ai/docs/api/sentisense-rating/)

### Insights

```typescript
client.insights.stock("AAPL")      // signals for one stock
client.insights.market()           // market-wide signals
client.insights.latest()           // the newest across every stock; free keys get the top 5
client.insights.types("AAPL")      // which signal types exist for a stock
```

[Insights API docs](https://sentisense.ai/docs/api/insights/)

### Insider trading (Form 4)

```typescript
client.insider.getActivity({ lookbackDays: 30 })         // buying and selling across the market
client.insider.getTrades("NVDA", { lookbackDays: 90 })   // each filed trade in one stock
client.insider.getClusterBuys({ lookbackDays: 90 })      // three or more insiders buying the same stock
```

Count real buying and selling by `transactionCode` (`P` and `S` are open-market trades). `transactionType` also labels shares withheld for taxes, code `F`, as `SELL`. [Insider API docs](https://sentisense.ai/docs/api/insider-trading/)

### Options

```typescript
client.options.getOverview()                                  // where options activity is unusual today
client.stocks.getOptionsSummary("NVDA")                       // one stock's options picture
client.stocks.getOptionsHistory("NVDA", { window: "2y" })     // the same readings as a daily series
client.stocks.getOptionsIntradayHistory("NVDA")               // every 15-minute reading from one session (PRO)
```

Apart from the intraday history, these are end-of-day readings, each measured against the stock's own past year. The overview ranks stocks and ETFs separately. For an uncovered ticker, `getOptionsSummary` returns `data: null`. [Options API docs](https://sentisense.ai/docs/api/options/)

### Congressional trading

```typescript
client.politicians.getActivity({ lookbackDays: 90 })   // recent disclosed trades
client.politicians.getFilings("NVDA")                  // trades in one stock
client.politicians.getMembers()                        // members in office, with trading stats
client.politicians.getMember("nancy-pelosi")           // one member's profile and trades
client.politicians.getDirectory({ q: "tex" })          // find a slug, including former members
```

The activity feed returns 200 rows unless you pass `limit`, so walk it with `offset` until you reach `totalCount`:

```typescript
const first = await client.politicians.getActivity({ limit: 100 });
console.log(`${first.data.length} of ${first.totalCount} disclosures`);
```

[Politicians API docs](https://sentisense.ai/docs/api/politicians/)

### Institutional flows (13F)

```typescript
client.institutional.getQuarters()                                    // the 13F quarters we hold, newest first
client.institutional.getFlows()                                       // the latest quarter's biggest inflows and outflows
client.institutional.getHolders("AAPL", "2026-06-30", { limit: 25 })  // who holds a stock
client.institutional.getHoldersHistory("AAPL", { quarters: 8 })       // ownership quarter by quarter
client.institutional.listInstitutions()                               // find funds, largest first
client.institutional.getInstitutionDetail("Berkshire-Hathaway", { limit: 10, sortBy: "estimatedFlowUsd" })
client.institutional.getInstitutionHistory("Renaissance-Technologies", { quarters: 8, tickers: ["NVDA"] })
client.institutional.getActivists("2026-06-30")                       // activist positions for a quarter
```

The newest quarter is often incomplete, so pick one by its `pending` flag rather than taking the first. A widely held stock has thousands of holders, so pass `limit`; `offset`, `sortBy` and `sortDir` only work alongside it.
`getInstitutionDetail` returns `unknown`, so cast it to `PreviewResponse<InstitutionDetail>`; its sort and filter options also need `limit`.

```typescript
const quarter = (await client.institutional.getQuarters()).find((q) => !q.pending)?.reportDate;
if (quarter) {
  const top = await client.institutional.getHolders("AAPL", quarter, { limit: 10, sortBy: "valueUsd" });
  for (const holder of top.data.holders) console.log(holder.filerName, holder.valueUsd);
}
```

[13F API docs](https://sentisense.ai/docs/api/institutional-flows/)

### Analyst ratings

```typescript
client.analyst.consensus("AAPL")                          // price target range, analyst count, upside
client.analyst.consensusHistory("AAPL", { limit: 90 })    // the consensus day by day
client.analyst.calledIt("AAPL")                           // which analysts called the stock's big moves
client.analyst.actions("AAPL", { lookbackDays: 30 })      // upgrades and downgrades, with price targets
client.analyst.estimates("AAPL")                          // EPS estimates and past surprises
client.analyst.marketActivity({ lookbackDays: 7 })        // analyst actions across every stock
client.analyst.coverage("NVDA")                           // who covers a stock and what they said last
client.analyst.profile("gil-luria")                       // one analyst and the stocks they cover
client.analyst.calls("gil-luria", { limit: 25 })          // their price target notes, newest first
```

`priceTarget` and `priorPriceTarget` on action rows are `null` when the firm stated none, never zero. [Analyst API docs](https://sentisense.ai/docs/api/analyst-ratings/)

### Earnings

```typescript
client.calendar.getEarnings()                                       // upcoming report dates and estimates
client.earnings.getSummaries("AAPL", { limit: 4 })                  // each quarter written up: headline, KPIs, guidance, call summary
client.earnings.getRecent({ days: 7 })                              // who reported recently
client.earnings.getReactions("AAPL")                                // how the stock moved after its last reports
client.earnings.getStatistics({ window: "week_to_date" })           // beat rates and reactions across the market
client.earnings.getRanked({ reportedDays: 14, upcomingDays: 7 })    // the reports that mattered most
```

```typescript
const [quarter] = (await client.earnings.getSummaries("AAPL", { limit: 1 })).data;
if (quarter) console.log(quarter.fiscalPeriod, quarter.headline);
```

[Earnings API docs](https://sentisense.ai/docs/api/earnings/)

### Company KPIs (PRO)

```typescript
client.stocks.getKpis("TSLA")        // product and segment metrics over time, like Tesla deliveries
client.stocks.listKpiCoverage()      // which companies have KPIs (free, no quota cost)
client.stocks.getKpiTypes("TSLA")    // which KPIs a company has
```

Free keys get the full series for the [sample companies](https://sentisense.ai/docs/api/#full-sample-responses-with-a-free-key), such as TSLA, and a preview for the rest.

### ETFs (beta)

```typescript
client.etfs.list()                                           // every ETF we track
client.etfs.quote("SPY")                                     // a fund's quote with AUM, expense ratio and NAV
client.etfs.holdings("QQQ")                                  // what the fund holds, with weights
client.etfs.analystAggregate("QQQ")                          // analyst consensus across the holdings, by weight
client.etfs.insiderAggregate("ARKK", { lookbackDays: 90 })   // insider buying and selling across the holdings
client.etfs.sentimentAggregate("QQQ")                        // the fund's Score, from holdings and from talk about the fund
```

[ETF API docs](https://sentisense.ai/docs/api/etfs/)

### Screener

```typescript
client.screener.fields()                        // every field you can filter on
client.screener.screens()                       // our ready-made screens
client.screener.run({ plan, tickers, limit })   // run a screen over stocks
client.screener.runEtfs({ plan, limit })        // run a screen over ETFs
```

```typescript
// High 7-day Score, few analyst buy ratings
const res = await client.screener.run({
  plan: {
    filters: [
      { fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 },
      { fieldName: "ANALYST_BUY_RATIO_PCT", op: "LTE", value: 30 },
    ],
    sort: { fieldName: "SENTI_SCORE_7D", dir: "DESC" },
  },
  limit: 25,
});
for (const row of res.results) console.log(row.ticker, row.sentiSenseScore7D, row.analystBuyRatioPct);
```

`ANALYST_RATING_MEAN` runs backwards (1 is strong buy), so prefer `ANALYST_BUY_RATIO_PCT`. [Screener API docs](https://sentisense.ai/docs/api/screener/)

### Market mood

```typescript
client.marketMood.get({ days: 30 })   // Market Mood, from fear to greed, with its history
client.indexes.list()                 // our indexes
client.indexes.history("ai-sentiment") // one index over time
```

[Market Mood API docs](https://sentisense.ai/docs/api/market-mood/)

### Trackers

```typescript
const { trackers } = await client.trackers.list();
const tx = await client.trackers.get("data-center-moratoriums", { filter: { state: "TX" } });
for (const row of tx.data.rows ?? []) console.log(row.rowId, row.name);
```

Every tracker uses the same envelope, so render by its `viewType`. Columns we don't type yet are still on each row. [Trackers API docs](https://sentisense.ai/docs/api/trackers/)

### Knowledge base

```typescript
client.kb.getPopularEntities()                                  // the most-followed people, products and companies
client.kb.searchEntities("Tesla", { type: "company", limit: 5 }) // turn a name into a ticker and slug
```

`searchEntities` returns a plain array, empty when nothing matches. [Entities API docs](https://sentisense.ai/docs/api/entities/)

## Error handling

```typescript
import SentiSense, { NotFoundError, RateLimitError } from "sentisense";

try {
  const price = await client.stocks.getPrice("AAPL");
} catch (error) {
  if (error instanceof NotFoundError) console.log("Not covered:", error.code);
  else if (error instanceof RateLimitError) console.log(error.message);
}
```

| Error class | HTTP status | When |
|-------------|-------------|------|
| `AuthenticationError` | 401, 403 | The key is missing or wrong |
| `NotFoundError` | 404 | We don't track that symbol, or hold nothing of that kind for it |
| `RateLimitError` | 429 | The per-minute limit (`retryAfter`) or the monthly allowance (`code: "quota_exceeded"`) |
| `DeepHistoryUnavailableError` | 202 | A `10Y` or `MAX` chart is still being built. Try again shortly |
| `TemporarilyUnavailableError` | 503 | The server asked for a longer wait than the client allows |
| `APIError` | other | Anything else |

All of them extend `SentiSenseError` and carry `status`, `code`, `message` and `body`, the parsed error response: a 404's `suggestions` and `coverage` block, a free key's 429 `upgrade` block. The client already retried what it could before throwing.

## Links

- API docs: [sentisense.ai/docs/api](https://sentisense.ai/docs/api/)
- Help with keys, limits and previews: [sentisense.ai/docs/support](https://sentisense.ai/docs/support/)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

SentiSense provides research data for informational and educational purposes, not investment advice.

## License

MIT
