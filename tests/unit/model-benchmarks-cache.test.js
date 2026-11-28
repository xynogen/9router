import { expect, it, vi } from "vitest";

it("downloads the catalog once, even for concurrent callers", async () => {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => ({
        data: [{ id: "openai/gpt-x", benchmarks: { artificial_analysis: { intelligence: 60 } } }],
        meta: { has_more: false },
      }),
    };
  });

  vi.resetModules();
  const { GET } = await import("../../src/app/api/models/benchmarks/route.js");

  const [first, second] = await Promise.all([GET(), GET()]);
  expect(calls).toHaveLength(1);
  expect((await first.json()).models).toHaveLength(1);
  expect((await second.json()).models).toHaveLength(1);

  // A later request is served from the process cache.
  await GET();
  expect(calls).toHaveLength(1);
});
