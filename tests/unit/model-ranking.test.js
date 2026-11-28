import { test } from "vitest";
import assert from "node:assert/strict";
import { benchmarkScore, rankModelGroups, rankModelList } from "../../src/shared/utils/modelRanking.js";

const model = (id, aa) => ({ id: `openai/${id}`, benchmarks: aa ? { artificial_analysis: aa } : null });

test("intelligence score and missing-measurement renormalization", () => {
  assert.equal(benchmarkScore(model("a", { intelligence: 65 })), 100);
  assert.equal(benchmarkScore(model("a", { intelligence: 70 })), 108);
  assert.equal(benchmarkScore(model("a", { coding: 80 })), 86);
  assert.equal(benchmarkScore(model("a", {})), null);
});

test("ranks only matched available models; leaves off-catalog and placeholders unranked", () => {
  const catalog = [model("top", { intelligence: 60 }), model("low", { intelligence: 30 }), model("unscored", {})];
  const groups = {
    cx: { alias: "openai", models: [
      { id: "low", name: "Low", value: "cx/low" },
      { id: "top", name: "Top", value: "cx/top" },
      { id: "unscored", name: "Unscored", value: "cx/unscored" },
      { id: "missing", name: "Missing", value: "cx/missing" },
      { id: "__placeholder__cx", name: "Placeholder", isPlaceholder: true },
    ] },
  };
  const ranked = rankModelGroups(groups, catalog).cx.models;
  assert.deepEqual(ranked.map(({ id, rank }) => [id, rank]), [
    ["top", 1], ["low", 2], ["unscored", 3], ["missing", null], ["__placeholder__cx", null],
  ]);
  assert.equal(groups.cx.models[0].rank, undefined);
});

test("rankModelList keeps the caller's order and keys ranks by model id", () => {
  const catalog = [model("top", { intelligence: 60 }), model("low", { intelligence: 30 })];
  const models = [{ id: "low" }, { id: "top" }, { id: "unknown" }];
  const ranks = rankModelList(models, "openai", catalog);
  assert.deepEqual(models.map((m) => m.id), ["low", "top", "unknown"]);
  assert.deepEqual(ranks.get("top"), { rank: 1, score: 92 });
  assert.deepEqual(ranks.get("low"), { rank: 2, score: 46 });
  assert.deepEqual(ranks.get("unknown"), { rank: null, score: null });
});

test("matches vendor-prefixed ids from compatible providers", () => {
  const catalog = [
    { id: "qwen/qwen3-14b", benchmarks: { artificial_analysis: { intelligence: 30 } } },
    { id: "deepseek/deepseek-v4.1-flash-1017", benchmarks: { artificial_analysis: { intelligence: 50 } } },
  ];
  const ranks = rankModelList([{ id: "Qwen/Qwen3-14B" }, { id: "deepseek-ai/DeepSeek-V4.1-Flash-1017" }], "di", catalog);
  assert.equal(ranks.get("deepseek-ai/DeepSeek-V4.1-Flash-1017").rank, 1);
  assert.equal(ranks.get("Qwen/Qwen3-14B").rank, 2);
});
