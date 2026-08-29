// Anthropic rejects input_schema whose ROOT is oneOf/allOf/anyOf
// ("input_schema does not support oneOf, allOf, or anyOf at the top level"),
// while nested unions (inside properties) are fine. OpenAI-compat clients
// commonly emit root-level anyOf, so flatten it before forwarding.
//
// ponytail: root union is flattened to its most descriptive variant
// (object > array > scalar) — lossy. Full JSON Schema union support would
// require rewriting every nested schema and is not needed to unblock 400s.

function variantScore(item) {
  if (item.type === "object" || item.properties) return 3;
  if (item.type === "array" || item.items) return 2;
  if (item.type && item.type !== "null") return 1;
  return 0;
}

export function normalizeClaudeInputSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return schema;
  const out = { ...schema };

  // allOf: merge variants' properties/required into the root (same approach
  // as mergeAllOf in formats/gemini.js)
  if (Array.isArray(out.allOf)) {
    for (const item of out.allOf) {
      if (!item || typeof item !== "object") continue;
      if (item.properties)
        out.properties = { ...out.properties, ...item.properties };
      if (Array.isArray(item.required)) {
        out.required = [
          ...new Set([...(out.required || []), ...item.required]),
        ];
      }
    }
    delete out.allOf;
  }

  // anyOf/oneOf: keep the best variant's keys, drop the union
  for (const key of ["anyOf", "oneOf"]) {
    if (!Array.isArray(out[key]) || out[key].length === 0) continue;
    const variants = out[key].filter(
      (v) => v && typeof v === "object" && v.type !== "null",
    );
    const pool = variants.length > 0 ? variants : out[key];
    const best = pool.reduce((a, b) =>
      variantScore(b) > variantScore(a) ? b : a,
    );
    for (const [k, v] of Object.entries(best)) {
      if (out[k] === undefined) out[k] = v;
    }
    delete out[key];
  }

  if (!out.type) out.type = "object";
  return out;
}
