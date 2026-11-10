import SentiSense from "sentisense";

const client = new SentiSense({ apiKey: process.env.SENTISENSE_API_KEY });

// Discover which trackers accept a filter, and the values each filter allows.
const { trackers } = await client.trackers.list();
for (const tracker of trackers) {
  for (const filter of tracker.filters ?? []) {
    console.log(`${tracker.trackerId}: ${filter.key} (${filter.values.length} values)`);
  }
}

// One state's data center moratorium records, including company filings that name it.
const tx = await client.trackers.get("data-center-moratoriums", { filter: { state: "TX" } });
console.log(`${tx.totalCount} records for TX`);
for (const row of tx.data.rows ?? []) {
  const company = row.ticker ? ` [${row.ticker}]` : "";
  const ends = row.endsDate ? `, ends ${row.endsDate}` : "";
  console.log(`- ${row.name}${company}${ends}`);
}
