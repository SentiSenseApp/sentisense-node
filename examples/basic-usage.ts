import SentiSense from "sentisense";

// Public endpoints work without an API key
const client = new SentiSense();

// Get a stock price
const price = await client.stocks.getPrice("AAPL");
console.log(`AAPL: $${price.price} (${price.changePercent > 0 ? "+" : ""}${price.changePercent}%)`);

// Get multiple prices
const prices = await client.stocks.getPrices(["AAPL", "NVDA", "TSLA"]);
for (const [ticker, p] of Object.entries(prices)) {
  console.log(`${ticker}: $${p.price}`);
}

// Company profile
const profile = await client.stocks.getProfile("NVDA");
console.log(`${profile.name} — ${profile.sector} / ${profile.industry}`);

// Market status
const status = await client.stocks.getMarketStatus();
console.log(`Market is ${status.status}`);

// Chart data
const chart = await client.stocks.getChart("AAPL", { timeframe: "3M" });
console.log(`${chart.data.length} data points`);
