import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

// Get available quarters
const quarters = await client.institutional.getQuarters();
const latestQuarter = quarters[0];
console.log(`Latest quarter: ${latestQuarter.label}`);

// Institutional endpoints return a preview envelope: the payload is in `.data`,
// and `isPreview` tells you whether it was truncated for your tier.
const flows = await client.institutional.getFlows(latestQuarter.reportDate, { limit: 10 });

console.log("--- Inflows (net buying) ---");
for (const flow of flows.data.inflows) {
  console.log(`${flow.ticker}: NET BUY ${flow.netSharesChange.toLocaleString()} shares`);
}

console.log("\n--- Outflows (net selling) ---");
for (const flow of flows.data.outflows) {
  console.log(`${flow.ticker}: NET SELL ${Math.abs(flow.netSharesChange).toLocaleString()} shares`);
}

// Holders nest one level deeper: the rows are in `.data.holders`, alongside
// ticker-level totals such as `holderCount`.
const holders = await client.institutional.getHolders("AAPL", latestQuarter.reportDate);
const newPositions = holders.data.holders.filter((h) => h.changeType === "NEW");
console.log(
  `\n${newPositions.length} new institutional positions in AAPL, of ${holders.data.holderCount} total holders`,
);

// Activist positions come back as a plain array inside the envelope.
const activists = await client.institutional.getActivists(latestQuarter.reportDate);
console.log(`\n${activists.data.length} activist positions this quarter`);
