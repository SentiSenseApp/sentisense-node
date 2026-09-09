import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });
const ranked = await client.earnings.getRanked({ reportedDays: 14 });

for (const row of ranked.data.reported.rows) {
  const reactions = await client.earnings.getReactions(row.ticker);
  const latest = reactions.reactions[0];
  console.log(row.ticker, row.outcome, latest?.movePct);
}
