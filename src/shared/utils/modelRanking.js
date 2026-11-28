// Display-only scores; never used for routing or model availability.
const INTELLIGENCE_REFERENCE = 65;
const ESTIMATE_SLOPE = 120.6;
const ESTIMATE_INTERCEPT = -10.6;

const blend = (parts) => {
  const present = parts.filter(([, value]) => Number.isFinite(value));
  const weight = present.reduce((sum, [w]) => sum + w, 0);
  return weight ? present.reduce((sum, [w, value]) => sum + w * value, 0) / weight : null;
};
const fraction = (value) => Number.isFinite(value) ? value / 100 : null;

export function benchmarkScore(model) {
  const aa = model?.benchmarks?.artificial_analysis;
  if (!aa) return null;
  if (Number.isFinite(aa.intelligence)) return Math.round(aa.intelligence / INTELLIGENCE_REFERENCE * 100);
  const coding = blend([[0.6, fraction(aa.coding)], [0.4, aa.scicode]]);
  const agentic = blend([[0.7, aa.tau2], [0.3, fraction(aa.agentic)]]);
  const reasoning = blend([[0.6, aa.gpqa], [0.4, aa.hle]]);
  const estimate = blend([[0.3, coding], [0.6, agentic], [0.1, reasoning]]);
  return estimate === null ? null : Math.round(Math.max(0, Math.min(100, ESTIMATE_SLOPE * estimate + ESTIMATE_INTERCEPT)));
}

const normalized = (id) => id.toLowerCase().replace(/[:@].*$/, "").replace(/[._]/g, "-").replace(/-\d{8}$/, "");

export function rankModelGroups(groups, catalog) {
  const byId = new Map(catalog.filter((m) => typeof m?.id === "string").map((m) => [normalized(m.id), m]));
  const bySlug = new Map();
  for (const model of catalog) {
    if (typeof model?.id !== "string") continue;
    const slug = normalized(model.id.split("/").at(-1));
    if (!bySlug.has(slug)) bySlug.set(slug, model);
  }
  const entries = Object.entries(groups).flatMap(([providerId, group]) => group.models.map((model) => {
    // Compatible providers use vendor-prefixed ids ("Qwen/Qwen3-14B"): try the id as a catalog id, then its last segment.
    const slug = normalized(model.id.split("/").at(-1));
    const benchmark = model.isPlaceholder ? null : byId.get(normalized(`${group.alias || providerId}/${model.id}`)) || byId.get(normalized(model.id)) || bySlug.get(slug);
    return { model, benchmark, score: benchmarkScore(benchmark) };
  }));
  entries.sort((a, b) => {
    const tier = (entry) => entry.score !== null ? 0 : entry.benchmark ? 1 : 2;
    return tier(a) - tier(b) || (b.score ?? 0) - (a.score ?? 0) ||
      (a.model.name || a.model.id).localeCompare(b.model.name || b.model.id);
  });
  let rank = 0;
  const ranked = new Map(entries.map((entry) => [entry.model, {
    ...entry.model,
    score: entry.score,
    rank: entry.benchmark && !entry.model.isPlaceholder ? ++rank : null,
  }]));
  return Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, {
    ...group,
    models: group.models.map((model) => ranked.get(model)).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.name || a.id).localeCompare(b.name || b.id)),
  }]));
}

/** Rank one provider's models by id, without reordering the caller's list. */
export function rankModelList(models, alias, catalog) {
  const ranked = rankModelGroups({ provider: { alias, models } }, catalog).provider.models;
  return new Map(ranked.map(({ id, rank, score }) => [id, { rank, score }]));
}
