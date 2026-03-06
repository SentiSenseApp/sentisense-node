import SentiSense, { AuthenticationError, RateLimitError } from "sentisense";

const client = new SentiSense({ apiKey: "ssk_YOUR_KEY" });

try {
  // Search for news
  const results = await client.documents.search("NVDA earnings beat", { days: 7, limit: 10 });
  for (const doc of results) {
    const sentiment = doc.averageSentiment > 0 ? "positive" : doc.averageSentiment < 0 ? "negative" : "neutral";
    console.log(`[${sentiment}] ${doc.text}`);
    console.log(`  ${doc.publisher} — ${new Date(doc.published * 1000).toLocaleDateString()}`);
  }

  // Get AI-curated story clusters
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
  console.log(`\n${redditPosts.length} Reddit posts about GME in the last 3 days`);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Check your API key at https://app.sentisense.ai/settings/developer");
  } else if (error instanceof RateLimitError) {
    console.error("Rate limit exceeded — upgrade your plan at https://sentisense.ai/pricing");
  } else {
    throw error;
  }
}
