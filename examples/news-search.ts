import SentiSense, { AuthenticationError, RateLimitError } from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

try {
  // Document endpoints return a wrapper: the rows are in `documents`, and
  // `totalCount` is the match count before your `limit` was applied.
  const results = await client.documents.search("NVDA earnings beat", { days: 7, limit: 10 });
  console.log(`${results.totalCount} matches, showing ${results.documents.length}`);
  for (const doc of results.documents) {
    const sentiment = doc.averageSentiment > 0 ? "positive" : doc.averageSentiment < 0 ? "negative" : "neutral";
    console.log(`[${sentiment}] ${doc.url}`);
    // `sourceName` is the publisher for news, and null on social sources, where the
    // platform in `source` is the better label.
    const publisher = doc.sourceName ?? doc.source;
    console.log(`  ${publisher}: ${new Date(doc.published * 1000).toLocaleDateString()}`);
  }

  // Story clusters come back as a plain array. The headline lives on `cluster`.
  const stories = await client.documents.getStories({ limit: 5 });
  for (const story of stories) {
    console.log(`\n--- ${story.cluster.title} ---`);
    console.log(`Impact: ${story.impactScore.toFixed(1)} | Tickers: ${story.tickers.join(", ")}`);
    console.log(`Articles: ${story.cluster.clusterSize}`);
  }

  // Get news for a specific stock from Reddit
  const redditPosts = await client.documents.getByTicker("GME", { source: "reddit", days: 3 });
  console.log(`\n${redditPosts.documents.length} Reddit posts about GME in the last 3 days`);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Check your API key at https://app.sentisense.ai/get-api-key");
  } else if (error instanceof RateLimitError) {
    console.error("Rate limit exceeded. Upgrade your plan at https://sentisense.ai/pricing");
  } else {
    throw error;
  }
}
