import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

// The field catalog is the discovery call: build filter UI from it rather than
// hardcoding names, and new fields appear without an SDK release.
const catalog = await client.screener.fields();
const sentimentFields = catalog.stock.filter((f) => f.group === "Sentiment");
for (const field of sentimentFields) {
  console.log(`${field.name} (${field.type}) ops=${field.ops.join("/")} — ${field.description}`);
}

// The curated screens double as worked examples: each plan runs as-is.
const { screens } = await client.screener.screens();
console.log(`\n${screens.length} curated screens`);
const crowdVsStreet = screens.find((s) => s.id === "crowd-vs-street");
if (crowdVsStreet) {
  const curated = await client.screener.run({ plan: crowdVsStreet.plan, limit: 10 });
  console.log(`\n${crowdVsStreet.name}: ${curated.matched} matched`);
  for (const row of curated.results) {
    console.log(`  ${row.ticker}  score7d=${row.sentiSenseScore7D}  buy%=${row.analystBuyRatioPct}`);
  }
}

// Or write your own. Filters are ANDed; the Score bands are 5 / 13 / 23.
// ANALYST_BUY_RATIO_PCT runs the intuitive direction, unlike ANALYST_RATING_MEAN
// which is the vendor's inverted 1-to-5 scale.
const res = await client.screener.run({
  plan: {
    filters: [
      { fieldName: "SENTI_SCORE_7D", op: "GTE", value: 13 },
      { fieldName: "ANALYST_BUY_RATIO_PCT", op: "LTE", value: 30 },
      // Coverage bottoms out at a single analyst, and a 0% buy ratio from one
      // analyst is noise, not disagreement. This leg is not decoration.
      { fieldName: "ANALYST_COUNT", op: "GTE", value: 5 },
    ],
    sort: { fieldName: "SENTI_SCORE_7D", dir: "DESC" },
  },
  limit: 25,
});

// `matched` is the count before `limit` was applied, so truncation is visible.
console.log(`\nCrowd bullish, street not: ${res.matched} matched, showing ${res.results.length}`);
for (const row of res.results) {
  console.log(`  ${row.ticker}  score7d=${row.sentiSenseScore7D}  buy%=${row.analystBuyRatioPct}`);
}

// Screen a watchlist instead of the whole universe by passing tickers.
const watchlist = await client.screener.run({
  plan: { filters: [{ fieldName: "MA_CROSS_STATE", op: "EQ", value: 1 }] },
  tickers: ["NVDA", "AMD", "AVGO", "INTC"],
});
console.log(`\nGolden cross in the watchlist: ${watchlist.results.map((r) => r.ticker).join(", ")}`);

// The ETF universe has its own field vocabulary. The weighted Score is the one
// you usually want; the direct Score is chatter about the fund ticker itself.
const funds = await client.screener.runEtfs({
  plan: {
    filters: [
      { fieldName: "CONSTITUENTS_WEIGHTED_SENTISENSE", op: "GT", value: 5 },
      { fieldName: "WEIGHT_COVERED_PCT", op: "GTE", value: 80 },
    ],
    sort: { fieldName: "CONSTITUENTS_WEIGHTED_SENTISENSE", dir: "DESC" },
  },
  limit: 10,
});
console.log(`\nBullish funds with real coverage: ${funds.matched} matched`);
for (const fund of funds.results) {
  console.log(
    `  ${fund.ticker}  weighted=${fund.constituentsWeightedSentisense}  covered=${fund.weightCoveredPct}%`,
  );
}
