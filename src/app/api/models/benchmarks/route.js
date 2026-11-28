import { NextResponse } from "next/server";

export async function GET() {
  try {
    const models = [];
    for (let offset = 0; offset < 2000; offset += 200) {
      const response = await fetch(`https://modelgrep.com/api/v1/models?sort=intelligence&limit=200&offset=${offset}`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`modelgrep returned ${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page.data)) throw new Error("Invalid modelgrep response");
      models.push(...page.data.map(({ id, benchmarks }) => ({ id, benchmarks })));
      if (!page.meta?.has_more) return NextResponse.json({ models });
    }
    throw new Error("modelgrep catalog exceeded page limit");
  } catch (error) {
    console.warn("Unable to load model benchmarks:", error);
    return NextResponse.json({ error: "Model benchmarks unavailable" }, { status: 502 });
  }
}
