import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: "ssk_YOUR_KEY" });

// Get available quarters
const quarters = await client.institutional.getQuarters();
const latestQuarter = quarters[0];
console.log(`Latest quarter: ${latestQuarter.label}`);

// Get top institutional flows
const flows = await client.institutional.getFlows(latestQuarter.reportDate, { limit: 10 });
for (const flow of flows) {
  const direction = flow.netSharesChange > 0 ? "NET BUY" : "NET SELL";
  console.log(`${flow.ticker} — ${direction} ${Math.abs(flow.netSharesChange).toLocaleString()} shares`);
}

// Get holders for a specific stock
const holders = await client.institutional.getHolders("AAPL", latestQuarter.reportDate);
const newPositions = holders.filter((h) => h.changeType === "NEW");
console.log(`\n${newPositions.length} new institutional positions in AAPL`);

// Get activist positions
const activists = await client.institutional.getActivists(latestQuarter.reportDate);
console.log(`\n${activists.length} activist positions this quarter`);
