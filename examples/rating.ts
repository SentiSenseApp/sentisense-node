import SentiSense from "sentisense";

// The SentiSense Rating is a relative research signal: it ranks a stock against the other
// stocks rated that same day, on six dimensions. It is informational and educational only,
// not financial, investment or trading advice, and not a recommendation about any security.
// Methodology: https://sentisense.ai/methodology/#sentisense-rating

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

const rating = await client.stocks.getRating("AAPL");

// Branch on `rated`, not on whether a field is undefined. The union narrows from here.
if (rating.rated) {
  // `score` is the number the letter bands: the percentile less the summed risk
  // adjustments. `percentile` stays the untouched rank of the blended signals, and
  // `bucketLetter` is the band that rank alone would fall in. Older responses omit all
  // five, so read them as optional.
  const score = rating.score !== undefined ? rating.score.toFixed(1) : "n/a";
  console.log(
    `${rating.ticker}: ${rating.letter} at ${score}, percentile ` +
      `${rating.percentile.toFixed(1)} of ${rating.ratedCount} rated stocks on ` +
      `${rating.asOf} (${rating.methodologyVersion})`,
  );

  // Each condition is graded rather than binary, so read the points off the row instead
  // of multiplying the 12-point maximum by how many conditions are listed.
  const adjustments = rating.riskAdjustments ?? [];
  if (adjustments.length) {
    console.log(
      `  ${adjustments.length} risk condition(s) cost ${rating.penaltyPoints} points, ` +
        `down from ${rating.bucketLetter}`,
    );
    for (const adj of adjustments) {
      console.log(`    ${adj.condition.padEnd(36)} -${adj.points.toFixed(1)}`);
    }
  }
} else {
  // Not a failure. ETFs and tickers outside the swept universe answer this way, and the
  // composition below still renders.
  console.log(`${rating.ticker}: no grade on ${rating.asOf} (${rating.reason})`);
}

// All six dimensions always arrive, in a fixed order, including the ones with no data.
// Read `present` first: a null percentile means we know nothing, which is not the same as
// ranking at the bottom of the market.
console.log("\nDimensions");
for (const dim of rating.dimensions) {
  if (!dim.present) {
    console.log(`  ${dim.label.padEnd(20)} no data`);
    continue;
  }
  const raw = dim.raw !== null ? `  (${dim.raw.toFixed(2)} ${dim.rawLabel ?? ""})` : "";
  console.log(`  ${dim.label.padEnd(20)} ${dim.percentile?.toFixed(1)}${raw}`);

  // Only smart money carries legs, so the field is absent everywhere else.
  for (const leg of dim.subLegs ?? []) {
    const value = leg.raw !== null ? `${leg.raw.toFixed(2)} ${leg.unit}` : "no data";
    console.log(`    ${leg.label.padEnd(24)} ${value}`);
  }
}

// Flags are informational and never move the composite. A rule the run could not evaluate
// is absent from the list rather than reported inactive.
const active = rating.flags.filter((f) => f.active);
console.log(`\nFlags active: ${active.length ? active.map((f) => f.label).join(", ") : "none"}`);

// The daily history of the score comes from the metrics time series.
const history = await client.entityMetrics.getMetrics(rating.ticker, {
  metricType: "sentisense_rating",
  startTime: Date.now() - 30 * 86400000,
});
console.log(`\n${history.length} daily score readings in the last 30 days`);

// Display this wherever you display a grade.
console.log(`\n${rating.disclaimer}`);
