import SentiSense from "sentisense";

// Every endpoint requires an API key. Get a free one at
// https://app.sentisense.ai/get-api-key
const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

// Get a stock price
const price = await client.stocks.getPrice("AAPL");
console.log(`AAPL: $${price.currentPrice} (${price.changePercent > 0 ? "+" : ""}${price.changePercent}%)`);

// Get multiple prices (returns a flat array; each item has a ticker field)
const prices = await client.stocks.getPrices(["AAPL", "NVDA", "TSLA"]);
for (const p of prices) {
  console.log(`${p.ticker}: $${p.currentPrice}`);
}

// Company profile
const profile = await client.stocks.getProfile("NVDA");
console.log(`${profile.name}: ${profile.sector} / ${profile.industry}`);

// Market status
const status = await client.stocks.getMarketStatus();
console.log(`Market is ${status.status}`);

// Chart data
const chart = await client.stocks.getChart("AAPL", { timeframe: "3M" });
console.log(`${chart.data.length} data points`);
