import { NextResponse } from "next/server";

// modelgrep has no cache headers we can rely on, and every picker open would
// otherwise re-download the catalog. Keep one copy per server process.
const TTL_MS = 60 * 60 * 1000;
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

let cache = null;
let inflight = null;

async function fetchCatalog() {
  const models = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const response = await fetch(`https://modelgrep.com/api/v1/models?sort=intelligence&limit=${PAGE_SIZE}&offset=${offset}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`modelgrep returned ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error("Invalid modelgrep response");
    models.push(...body.data.map(({ id, benchmarks }) => ({ id, benchmarks })));
    if (!body.meta?.has_more) return models;
  }
  throw new Error("modelgrep catalog exceeded page limit");
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ models: cache.models });
  }
  try {
    // Share one upstream fetch between concurrent callers.
    inflight ??= fetchCatalog().finally(() => { inflight = null; });
    const models = await inflight;
    cache = { at: Date.now(), models };
    return NextResponse.json({ models });
  } catch (error) {
    console.warn("Unable to load model benchmarks:", error);
    // A stale catalog still beats an empty picker.
    if (cache) return NextResponse.json({ models: cache.models });
    return NextResponse.json({ error: "Model benchmarks unavailable" }, { status: 502 });
  }
}
