import { test } from "node:test";
import assert from "node:assert/strict";
import { benchmarkScore, rankModelGroups } from "../../src/shared/utils/modelRanking.js";

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
