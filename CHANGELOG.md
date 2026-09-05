# Changelog

## 0.54.0

### Added

- **Expected move on the options aggregate.** `OptionsAggregate` and `OptionsOverviewRow` gain
  six optional fields, all fractions of price over 1, 5 and 20 trading sessions (252 per year).
  `expectedMove1s1d`, `expectedMove1s5d` and `expectedMove1s20d` are the one-sigma industry
  convention, `atmIv * Math.sqrt(h / 252)`, with no calibration applied. `expectedMove1d`,
  `expectedMove5d` and `expectedMove20d` apply the same formula with an empirical scale (1.48 at
  one session, 1.56 at five and twenty) fit on SentiSense's own stored option history, giving a
  90% range whose measured out-of-sample coverage runs 90.4% to 91.4%. Read that coverage as a
  measured historical rate rather than a guarantee: the fields describe what the option chain
  implies today against the ticker's own past, and carry no direction and no price target.
  They ride on the daily aggregate, so they read the same from `stocks.getOptionsSummary()`'s
  `latest`, every row of `stocks.getOptionsHistory()`, and both boards of `options.getOverview()`.
- **`sentisense options <ticker>`** prints the calibrated one-session range next to ATM IV.
- **`InsiderTrade.securityBasis`**, set when a Form 4 was filed in a security other than the
  listed US share (for example a foreign issuer's ordinary shares); on those rows `pricePerShare`
  is `null` rather than a converted number.
- **ETF holding venue fields.** `EtfHolding` gains `exchange`, `localTicker` and `linkedTicker`.
  For holdings listed outside the US, `ticker` is the local symbol on `exchange`; resolve to a
  SentiSense stock only through `linkedTicker`, which is `null` when there is no US listing.
- **`upgrade` on preview envelopes.** Present only when `isPreview` is true, it describes how to
  lift the gate so an agent has something concrete to relay.

### Fixed

- **Documentation: the README now names every method that returns the preview envelope** (33, grouped by namespace and pinned to the source by a test, where the old list named 8), and corrects the options-dossier note: an uncovered ticker arrives as `data: null` inside the envelope, so the response object itself is always truthy.

## 0.53.0

### Added

- **Story provenance on the cluster.** `StoryCluster` gains `storySource` and `isLive`.
  `storySource` is `"ORIGINAL"` for an editorially authored SentiSense Original and
  `"AI"` for a pipeline-generated story; `isLive` is true while the story is still being
  revised as the event develops. Both are optional, so a response served before they
  shipped still typechecks and reads `undefined`, which means "not known" rather than
  `"AI"` or `false`.
- **`StoryTimelineEntry`**, exported. The story detail response carries a `timeline`
  array of dated updates, newest first and empty when a story has none, each with
  `publishedAt` (Unix milliseconds), `updateType` and markdown `content`.
  `getStoryDetail` still returns `unknown` and this type is for narrowing it yourself.
  `updateType` is left open past `"INITIAL"`, `"UPDATE"` and `"CORRECTION"`: an
  unrecognised label is served through rather than rejected.

## 0.52.0

### Added

- **`sentisense analysts <ticker> --coverage`.** Who covers a ticker, one row per firm:
  the analyst that firm last published under and the slug that addresses them, their latest
  price target and its date, and the firm's current rating and action. The header carries
  the whole-book counts and the `ratingBuckets` line (`buy`, `hold`, `sell`, `unrated`,
  `total`), which are counted before any free truncation, so the shown-of-total line and the
  buckets describe the full window even when the rows do not. `--days` sets the window,
  `--limit` trims the rows printed (the API returns the whole book either way) and `--full`
  prints all of them. `--json` is the coverage envelope untouched.
- **`sentisense analyst <slug>`.** One analyst: the firms they have published under with the
  window of notes at each, and their coverage book. `--calls` appends their price target
  notes, newest first, with `--limit` for the page size. It takes a slug, not a name, and a
  name is rejected before a request is spent with a pointer at where slugs come from, which
  is the coverage rows above. Every run prints that this is call history and not accuracy
  scoring: there is no hit rate, no ranking, and nothing in it rates the person.
- **`sentisense search <name>`.** Resolve a name, alias, ticker or slug to the entities we
  track, so a user who typed "Tesla" gets `TSLA` and the rest of a pipeline can carry on.
  Prints symbol, name, type and the slug the metric endpoints address an entity by, which is
  the only way to get one for a person, product or topic with no ticker. `--type` narrows to
  `person`, `company`, `product`, `organization`, `etf`, `topic` or `country`, `--limit` caps
  the matches. A query under 2 characters or an unknown `--type` is rejected before any
  request; a query that matches nothing exits 4, the same code an unknown symbol uses.
- **`client.kb.searchEntities(q, { type, limit })`** backs that command and is new to the
  SDK. It returns a bare `EntitySearchResult[]`, not a `PreviewResponse` envelope, and an
  empty array is the normal answer for a query that matches nothing. New type exports:
  `EntitySearchResult`, `EntitySearchType`, `SearchEntitiesOptions`.

Ranking on search is the API's own, and a company can sort below its own products: a bare
`search Tesla` puts several Tesla products above `Tesla, Inc.`. Pass `--type company` when
what you want is the issuer.

## 0.51.0

- **Renamed, breaking against 0.50.0.** `RatedStockRating` -> `StockRating`,
  `UnratedStockRating` -> `StockNotRated`, and the union `StockRating` ->
  `StockRatingResponse`, which is what `stocks.getRating` returns.
- `StockRating` gains `score`, `bucketLetter`, `riskConditions`, `riskAdjustments` and
  `penaltyPoints`, all optional. `score = percentile - sum(riskAdjustments.map((a) =>
  a.points))` and is what `letter` bands; `percentile` is unchanged. New `RiskAdjustment`
  and `RiskCondition` types; the `sentisense_rating` metric series carries the score.
- Use 0.51.0 instead of 0.50.0.

## 0.50.0

### Added

- **The SentiSense Rating, new to this SDK.** `client.stocks.getRating(ticker)` returns
  where a stock ranks against the other stocks rated that day: a letter, a percentile, the
  composite behind it, and the six dimensions the composite is blended from. It is a
  relative research signal for informational and educational purposes, not financial,
  investment or trading advice and not a recommendation about any security. Every response
  carries the wording to display alongside a grade in `disclaimer`.
  [Methodology](https://sentisense.ai/methodology/#sentisense-rating).
- Types exported from the package root: `StockRating`, `RatedStockRating`,
  `UnratedStockRating`, `RatingBase`, `RatingDimension`, `RatingDimensionKey`,
  `RatingSubLeg`, `RatingFlag` and `RatingNotRatedReason`. `StockRating` is a discriminated
  union on `rated`, so `if (rating.rated)` narrows to the graded fields and the `else`
  branch narrows to `reason`.
- `sentisense_rating` added to `MetricType`, which serves the daily history of a stock's
  percentile through `client.entityMetrics.getMetrics`. It is a time series only: there is
  no source breakdown, so `getDistribution` answers with an empty distribution for it.
- `examples/rating.ts` walks the whole shape: the grade, the dimensions with their legs,
  the flags, and the percentile history.
- `client.analyst.coverage()` now returns `ratingBuckets` next to `firmCount`: how many
  covering firms sit in each rating tier, as `buy`, `hold`, `sell`, `unrated` and `total`,
  typed by the new `AnalystRatingBuckets` export. Counted over the whole book before the
  free truncation, so `buy + hold + sell + unrated === total` and a free key reads the
  same numbers as a PRO one. `unrated` is a desk with no current rating on record, such as
  a price-target-only firm. It counts the firms in the coverage book, which is a different
  population from the `strongBuy` through `strongSell` survey figures on
  `client.analyst.consensus()`.

Two shapes to read rather than assume, both gated by tests. **Branch on `rated`.** A rated
stock carries `letter`, `percentile`, `composite`, `ratedCount` and `methodologyVersion`; an
unrated one carries `reason`, `dimensionsPresent` and `presentDimensions` instead. Having no
grade is a normal 200, not a 404: ETFs and tickers outside the swept universe answer that
way, and `reason` says which case it is. And `dimensions` always holds all six rows in a
fixed order, including the ones with no data, which arrive with `present` false and a `null`
percentile. Read `present` first and never substitute zero for a missing percentile: zero is
the bottom of the cross-section, absence is not a position on it.

### Fixed

- The metric type list in the README named `sentisense`, which is an accepted alias rather
  than the name the API echoes back. It now reads `sentisense_score`, matching the
  `MetricType` union.

## 0.49.0

### Added

- **Analyst coverage by name, new to this SDK.** `client.analyst.coverage(ticker)` answers
  "who covers this stock and what did they most recently say", grouped by firm and ordered
  by most recent activity. `client.analyst.profile(slug)` returns one analyst: the firms
  they have published under, the window of notes we hold at each, and their coverage book.
  `client.analyst.calls(slug, { limit, offset })` returns that analyst's price target
  notes, newest first and paged.
- The three surfaces link up: every named analyst on a coverage row carries the `slug` that
  addresses their profile and their calls, so a ticker is one call away from a person's full
  call history. An unknown slug throws `NotFoundError`, which keeps "we hold nothing from
  this analyst" distinguishable from "this analyst does not exist".
- Types for all of it, exported from the package root: `AnalystCoverage`,
  `AnalystCoverageFirm`, `AnalystCoverageAnalyst`, `AnalystNote`, `AnalystFirmRating`,
  `AnalystProfile`, `AnalystFirmTenure`, `AnalystCoverageBookEntry`, `AnalystCall`,
  `GetAnalystCoverageOptions`, `GetAnalystCallsOptions`.

Two coverage shapes to read rather than assume. A firm can cover a stock on rating actions
alone, with no price target: that row carries `noteCount: 0`, a `null` `latestNote` and a
populated `firmRating`. And a large, publisher-dependent share of notes name no individual
analyst, so a firm can appear with an empty `analysts` array and a non-zero `noteCount`.
Read `attributedNoteCount` and `unattributedNoteCount` off the response rather than
hardcoding a rate. On a FREE key the rows truncate to 5 firms but every response-level count
still describes the whole window.

## 0.48.0

### Added

- `EtfInfo.imageUrl`: the curated landscape card image for a fund, returned by the ETF
  listing. It is a wide presentation image rather than a square logo mark, so it suits a
  list row or a profile header. Null when a fund has no curated image.
- `StockProfile.imageUrl`: the same image on a tracked ETF ticker's profile. Distinct from
  `logoUrl` and `iconUrl`, which stay square branding marks.

### Fixed

- The exported `VERSION` constant had drifted behind `package.json` and reported `0.47.1`
  from the 0.47.2 release, so the version the client sent in its User-Agent understated the
  installed release. Both are back in step.

## 0.47.2

### Changed

- Copyright holder in `LICENSE` updated to the current legal entity. No code or API changes.

## 0.47.0

### Fixed

- **`stocks.listDetailed()` and `stocks.listPopularDetailed()` now carry the company names
  they promised.** The API returns `simpleName` ("Agilent") and `companyName` ("Agilent
  Technologies, Inc."), but `StockDetail` only declared a `name` field that the API has never
  sent, so every row read `undefined` and anything touching `.name` threw. `simpleName` and
  `companyName` are now declared, and `name` is filled from `simpleName` so existing code
  reads a name instead of crashing. `brandColor` and `socialDominance` were also already in
  the response and previously undeclared; both are now typed, and the new
  `StockSocialDominance` type is exported.

### Added

- **Options Intelligence, most of it new to the SDK.** `client.options.getOverview()` returns the
  market-wide radar, and `client.stocks.getOptionsHistory(ticker, { window })` returns a name's
  daily aggregates as a time series over `1y`, `2y` or `5y`. `client.stocks.getOptionsSummary` is
  unchanged.
- New exported types: `OptionsOverview`, `OptionsOverviewRow`, `OptionsHistory`,
  `OptionsHistoryWindow`, `GetOptionsHistoryOptions`.

Two behaviours worth knowing before you chart any of it. The radar's `rows` and `etfRows` are
separately-ranked boards and must not be merged, because every reading behind a row's score is a
percentile of that ticker's own history rather than of the board. And `getOptionsHistory` reports
an uncovered ticker as an empty `series`, not as the `null` payload `getOptionsSummary` uses, so
read the array's length there.

## 0.46.0

### Changed

- **`insiders` no longer counts tax withholding as selling.** Form 4 code `F` rows (shares
  withheld by the issuer to cover taxes at vest) arrive typed `SELL` but are mechanical, not a
  decision to sell. The `sold:` headline now sums open-market sales only; withholding shows as
  its own `withheld:` figure when present, and those rows read `TAX-W` in the table instead of
  a red `SELL`. `--json` is unchanged: it remains the exact API response, every row as filed.

## 0.45.0

### Fixed

- **`news --days N` now sends the parameter the API actually reads**, so the flag narrows the
  market-wide window as documented instead of being silently ignored. A short window can be
  legitimately empty; the command says so rather than widening it behind your back.
- **Dividend yield no longer renders 100x too small for fractional values.** A 2.89% yield
  displayed as 0.03%. Ratio-scaled fields and percent-scaled fields are now formatted by what
  the API serves, not by one shared assumption.
- Rejected-request hints (HTTP 400) now point at the caller's input rather than blaming the
  service, and exit 1, keeping the documented split: 1 means the API rejected the request,
  2 means the CLI refused the input before any request was sent.

## 0.44.0

### Added

- **Voluntary caller identity.** Set `SENTISENSE_SKILL` (the slug of the skill driving the
  tool) and `SENTISENSE_AGENT_NAME` (what your agent is called) and requests carry that
  identity in the User-Agent comment, as in `(stock-analysis; agent/research-desk)`. Both are
  optional, resolved flag first (`--skill`, `--agent`), then environment, then stored config
  (`auth --skill ... --agent ...`). Values are sanitized to a safe character set and capped at
  32 characters, so nothing you set can reshape the header.

## 0.43.0

### Changed

- **Surplus tickers are rejected, not dropped.** Single-ticker commands given two symbols exit
  2 with a message naming both, instead of silently answering for the first one.
- **Unknown tickers exit 4.** A command returning an empty result now verifies the symbol
  exists before exiting, so a typo reads as "no such symbol" rather than "no data".
- Help examples corrected to commands that answer with live data.

## 0.42.0

### Added

- **A command line interface, in this same package.** `npx -y sentisense quote NVDA` and
  thirteen siblings: `auth`, `health`, `quote`, `sentiment`, `mood`, `analysts`, `earnings`,
  `insiders`, `insights`, `congress`, `news`, `flows`, `options`, `screen`. Three output
  modes: a readable terminal layout, plain text when piped, and `--json` for the exact API
  response, envelope included. Stable exit codes 0 through 6, documented in the README. Keys
  come from `SENTISENSE_API_KEY` or a stored config at `~/.config/sentisense/` (mode 600,
  `auth --remove` to delete).
- **`stocks.getOptionsSummary(ticker)`**: the end-of-day options dossier as an SDK method.
- **`userAgentSuffix` client option**: append your tool's own identity to the User-Agent.

### Fixed

- `CongressTrade.party` and `state` are typed nullable, matching rows the wire actually serves.

## 0.41.0

### Added

- **`politicians.getMember(slug, options?)`** now takes `limit` and `offset`: `data
  .recentTrades` is one page of a member's history, and the server returns 200 by default
  rather than everything. Most members have a few dozen disclosures and still arrive complete
  in one call; a handful have thousands, and the longest is over 12,000. Read `totalCount` on
  the envelope for the size of the whole history and page through it. `options` is optional,
  so calls that omit it send exactly the request they sent before.

  `data.profile` and `data.topTickers` describe the whole history whatever page you ask for,
  so `profile.totalTrades` does not shrink with a small `limit`.

- **`GetPoliticianMemberOptions`**: the paging options type, exported for callers that build
  request options separately.

## 0.40.0

### Added

- **`politicians.getDirectory(options?)`**: discover tracked members of Congress and the page
  slug identifying each, so you can find who to query without knowing slugs upfront. Summary
  only, no trade data; use `politicians.getMember(slug)` for filings. Requires an API key but
  does not consume monthly quota, and is not tier-gated. Filter with `q`, page with `limit`
  and `offset`. Returns the unwrapped payload, matching `institutional.listInstitutions`.

  Unlike `getMembers`, the directory includes members who have **left Congress**. That roster
  lists who currently holds office, so a former member was previously reachable only if you
  already knew their slug.

- **`former` and `servedUntil` on `PoliticianSummary`**: the API has been returning both, but
  the type omitted them, so TypeScript callers could not read whether a member had left
  Congress. `former` is true only on a member detail or directory response, since the members
  roster serves sitting members exclusively.

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
