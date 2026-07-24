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
    console.log(`  ${doc.sourceName ?? doc.source}: ${new Date(doc.published * 1000).toLocaleDateString()}`);
  }

  // Story clusters come back as a plain array.
  const stories = await client.documents.getStories({ limit: 5, expanded: true });
  for (const story of stories) {
    console.log(`\n--- ${story.cluster.title} ---`);
    console.log(`Impact: ${story.impactScore}/10 | Tickers: ${story.tickers.join(", ")}`);
    if (story.topDocuments) {
      console.log(`Sources: ${story.topDocuments.length} articles`);
    }
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
