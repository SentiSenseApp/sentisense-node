import type { Block } from "./render/doc.js";

interface SampleSignals {
  sampleCompany?: boolean;
  upgrade?: { sampleTickers?: string[] } | null;
}

/**
 * The one line a free key's reader needs about the sample companies: why this answer is full,
 * or which companies would be. It reads the list from the response, so the CLI never carries
 * its own copy, and a PRO response, which has neither field, prints nothing.
 */
export function sampleNote(envelope: SampleSignals, ticker: string): Block | undefined {
  if (envelope.sampleCompany) {
    return {
      kind: "text",
      text: `${ticker} is a sample company: full data on every plan. PRO unlocks every company.`,
      tone: "dim",
    };
  }
  const tickers = envelope.upgrade?.sampleTickers;
  if (tickers && tickers.length > 0) {
    return {
      kind: "text",
      text: `Full data on every plan for the sample companies: ${tickers.join(", ")}.`,
      tone: "dim",
    };
  }
  return undefined;
}
