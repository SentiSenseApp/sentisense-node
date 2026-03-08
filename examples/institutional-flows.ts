import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: "ssk_YOUR_KEY" });

// Get available quarters
const quarters = await client.institutional.getQuarters();
const latestQuarter = quarters[0];
console.log(`Latest quarter: ${latestQuarter.label}`);

// Get top institutional flows (split into inflows and outflows)
const flows = await client.institutional.getFlows(latestQuarter.reportDate, { limit: 10 });

console.log("--- Inflows (net buying) ---");
for (const flow of flows.inflows) {
  console.log(`${flow.ticker} — NET BUY ${flow.netSharesChange.toLocaleString()} shares`);
}

console.log("\n--- Outflows (net selling) ---");
for (const flow of flows.outflows) {
  console.log(`${flow.ticker} — NET SELL ${Math.abs(flow.netSharesChange).toLocaleString()} shares`);
}

// Get holders for a specific stock
const holders = await client.institutional.getHolders("AAPL", latestQuarter.reportDate);
const newPositions = holders.filter((h) => h.changeType === "NEW");
console.log(`\n${newPositions.length} new institutional positions in AAPL`);

// Get activist positions
const activists = await client.institutional.getActivists(latestQuarter.reportDate);
console.log(`\n${activists.length} activist positions this quarter`);
