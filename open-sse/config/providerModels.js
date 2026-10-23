import REGISTRY from "../providers/registry/index.js";
// PROVIDER_MODELS now built from providers/registry (transport + models co-located)
import { PROVIDER_MODELS } from "../providers/index.js";
import { modelQuotaFamily, modelStrip, modelTargetFormat, modelSupportedFormats, normalizeModelId } from "../providers/models/schema.js";
import { CODEX_REVIEW_SUFFIX, isMuseSparkModel, opencodeFamilyFormats } from "../providers/models/helpers.js";
import { FORMATS } from "../translator/formats.js";
export { PROVIDER_MODELS };

// OpenCode providers sharing the endpoint-family fallback for unknown model ids
const isOpenCodeAlias = (aliasOrId) => !aliasOrId || ["oc", "opencode", "ocg", "opencode-go", "ocz", "opencode-zen"].includes(aliasOrId);


// Helper functions
export function getProviderModels(aliasOrId) {
  return PROVIDER_MODELS[aliasOrId] || [];
}

export function getDefaultModel(aliasOrId) {
  const models = PROVIDER_MODELS[aliasOrId];
  return models?.[0]?.id || null;
}

// Providers whose registry uses dots in version numbers (e.g. "claude-sonnet-4.5").
// For these, we tolerate clients sending dashes ("claude-sonnet-4-5") by normalizing
// digit-hyphen-digit to digit-dot-digit before lookup. Other providers are left untouched.
const DOT_VERSION_PROVIDERS = new Set(["kr", "kiro"]);

// Find a registry entry by id. For Kiro models, tolerates dash/dot version separators
// ("claude-sonnet-4-5" ~= "claude-sonnet-4.5"). Other providers use exact match only.
function findModel(models, modelId, aliasOrId) {
  if (!models) return undefined;
  const baseModelId =
    typeof modelId === "string"
      ? modelId.replace(/\([^()]+\)\s*$/, "").trim()
      : modelId;
  const found = models.find((m) => m.id === modelId || m.id === baseModelId);
  if (found) return found;
  if (!DOT_VERSION_PROVIDERS.has(aliasOrId)) return undefined;
  const normalized = normalizeModelId(baseModelId);
  if (normalized === baseModelId) return undefined;
  return models.find((m) => m.id === normalized);
}

export function isValidModel(
  aliasOrId,
  modelId,
  passthroughProviders = new Set(),
) {
  if (passthroughProviders.has(aliasOrId)) return true;
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return false;
  return !!findModel(models, modelId, aliasOrId);
}

export function findModelName(aliasOrId, modelId) {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return modelId;
  const found = findModel(models, modelId, aliasOrId);
  if (found?.name) return found.name;
  const baseId =
    typeof modelId === "string"
      ? modelId.replace(/\([^()]+\)\s*$/, "").trim()
      : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  if (meta?.name) return meta.name;
  return modelId;
}

export function getModelTargetFormat(aliasOrId, modelId) {
  if (isOpenCodeAlias(aliasOrId) && isMuseSparkModel(modelId)) {
    return FORMATS.OPENAI_RESPONSES;
  }
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return null;
  const baseId = typeof modelId === "string" ? modelId.replace(/\([^()]+\)\s*$/, "").trim() : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const targetId = meta?.tiers?.default || meta?.default || baseId;
  const found = findModel(models, targetId, aliasOrId);
  if (found) return modelTargetFormat(found);
  // Family fallback keeps modelsFetcher/passthrough ids on their endpoint lane
  if (isOpenCodeAlias(aliasOrId)) return opencodeFamilyFormats(modelId)?.targetFormat || null;
  return null;
}

// Declared upstream formats for a model (registry `supportedFormats`). Drives the
// per-model guard on the sourceFormat-matched transport; null when undeclared.
// Unknown OpenCode ids fall back to the family regex (chat lane by default) so
// auto-fetched models never wrongly use the sourceFormat-matched transport.
export function getModelSupportedFormats(aliasOrId, modelId) {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return null;
  const baseId = typeof modelId === "string" ? modelId.replace(/\([^()]+\)\s*$/, "").trim() : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const targetId = meta?.tiers?.default || meta?.default || baseId;
  const found = findModel(models, targetId, aliasOrId);
  if (found) return modelSupportedFormats(found);
  if (isOpenCodeAlias(aliasOrId)) return opencodeFamilyFormats(modelId)?.supportedFormats || [FORMATS.OPENAI];
  return null;
}

export function getModelType(aliasOrId, modelId) {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return null;
  const baseId =
    typeof modelId === "string"
      ? modelId.replace(/\([^()]+\)\s*$/, "").trim()
      : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const targetId = meta?.tiers?.default || meta?.default || baseId;
  const found = findModel(models, targetId, aliasOrId);
  return found?.kind || found?.type || null;
}

// Provider meta-models: maps base models to thinking level tiers when upstream uses distinct model names.
// ponytail: maps standard effort tiers (high/medium/low/none) to distinct backend model names.
export const PROVIDER_META_MODELS = {
  antigravity: {
    "gemini-3.8-flash": {
      name: "Gemini 3.8 Flash",
      tiers: {
        high: "gemini-3.8-flash-high",
        medium: "gemini-3.8-flash-medium",
        low: "gemini-3.8-flash-low",
        default: "gemini-3.8-flash-medium",
      },
    },
    "gemini-3.7-flash": {
      name: "Gemini 3.7 Flash",
      tiers: {
        high: "gemini-3.7-flash-high",
        medium: "gemini-3.7-flash-medium",
        low: "gemini-3.7-flash-low",
        default: "gemini-3.7-flash-medium",
      },
    },
    "gemini-3.6-flash": {
      name: "Gemini 3.6 Flash",
      tiers: {
        high: "gemini-3.6-flash-high",
        medium: "gemini-3.6-flash-medium",
        low: "gemini-3.6-flash-low",
        default: "gemini-3.6-flash-medium",
      },
    },
    "gemini-3.5-flash": {
      name: "Gemini 3.5 Flash",
      tiers: {
        high: "gemini-3.5-flash-high",
        medium: "gemini-3.5-flash-low",
        low: "gemini-3.5-flash-extra-low",
        default: "gemini-3.5-flash-low",
      },
    },
    "gemini-3.1-pro": {
      name: "Gemini 3.1 Pro",
      tiers: {
        high: "gemini-pro-agent",
        medium: "gemini-pro-agent",
        low: "gemini-3.1-pro-low",
        default: "gemini-pro-agent",
      },
    },
    "claude-sonnet-5-5": {
      name: "Claude Sonnet 5.5",
      tiers: {
        high: "claude-sonnet-5-5-high",
        medium: "claude-sonnet-5-5-medium",
        low: "claude-sonnet-5-5-low",
        default: "claude-sonnet-5-5-high",
      },
    },
    "claude-opus-5-5": {
      name: "Claude Opus 5.5",
      tiers: {
        high: "claude-opus-5-5-high",
        medium: "claude-opus-5-5-medium",
        low: "claude-opus-5-5-low",
        default: "claude-opus-5-5-high",
      },
    },
    "claude-opus-4-6": {
      name: "Claude Opus 4.6",
      tiers: {
        high: "claude-opus-4-6-thinking",
        medium: "claude-opus-4-6-thinking",
        low: "claude-opus-4-6-thinking",
        none: "claude-opus-4-6",
        default: "claude-opus-4-6-thinking",
      },
    },
    "claude-opus-4.6": {
      name: "Claude Opus 4.6",
      hidden: true,
      tiers: {
        high: "claude-opus-4-6-thinking",
        medium: "claude-opus-4-6-thinking",
        low: "claude-opus-4-6-thinking",
        none: "claude-opus-4-6",
        default: "claude-opus-4-6-thinking",
      },
    },
  },
};
PROVIDER_META_MODELS.ag = PROVIDER_META_MODELS.antigravity;

export function resolveThinkingTier(tiers, level) {
  if (!tiers || typeof tiers !== "object") return null;
  const l = typeof level === "string" ? level.toLowerCase().trim() : null;
  if (l === "high" || l === "xhigh" || l === "max" || l === "ultra") {
    return tiers.high || tiers.max || tiers.default;
  }
  if (l === "medium") {
    return tiers.medium || tiers.default;
  }
  if (l === "low" || l === "minimal") {
    return tiers.low || tiers.minimal || tiers.default;
  }
  if (l === "none" || l === "off" || l === "disabled") {
    return tiers.none || tiers.disabled || tiers.low || tiers.default;
  }
  if (Number.isFinite(Number(level)) && Number(level) > 0) {
    const budget = Number(level);
    if (budget <= 4096) return tiers.low || tiers.default;
    if (budget <= 16384) return tiers.medium || tiers.default;
    return tiers.high || tiers.default;
  }
  return tiers.default || tiers.medium || tiers.high || Object.values(tiers)[0];
}

// Raw registry entry for a model (suffix-aware) — executor lookups of per-model hints (e.g. defaultLocation).
export function getModelMeta(aliasOrId, modelId) {
  return findModel(PROVIDER_MODELS[aliasOrId], modelId, aliasOrId) || null;
}

// clientBody: request body (upstream tier-from-effort). A string is accepted as thinkingLevel (fork meta-models).
export function getModelUpstreamId(aliasOrId, modelId, clientBody = null, thinkingLevel = null) {
  if (typeof clientBody === "string") {
    thinkingLevel = clientBody;
    clientBody = null;
  }
  // Split off thinking suffix "(level)" so lookup hits the base id; re-append it to
  // the result so downstream applyThinking still sees the suffix (body.model is stripped separately).
  const sufMatch =
    typeof modelId === "string" ? modelId.match(/\([^()]+\)\s*$/) : null;
  const suffix = sufMatch ? sufMatch[0] : "";
  const baseId = suffix ? modelId.slice(0, sufMatch.index).trim() : modelId;
  const models = PROVIDER_MODELS[aliasOrId];

  // Resolve requested thinking level from suffix or client request body
  const rawSuffix = suffix ? suffix.slice(1, -1).trim().toLowerCase() : "";
  let tier = rawSuffix === "xhigh" || rawSuffix === "max" ? "high" : rawSuffix === "minimal" ? "low" : rawSuffix;
  if (!tier && clientBody && typeof clientBody === "object") {
    const rawEffort = clientBody.reasoning_effort || clientBody.output_config?.effort || (typeof clientBody.reasoning === "object" ? clientBody.reasoning?.effort : null);
    if (typeof rawEffort === "string" && rawEffort) {
      const v = rawEffort.toLowerCase().trim();
      tier = v === "xhigh" || v === "max" ? "high" : v === "minimal" ? "low" : v;
    } else if (clientBody.thinking && typeof clientBody.thinking === "object") {
      const b = Number(clientBody.thinking.budget_tokens);
      if (Number.isFinite(b) && b > 0) {
        tier = b > 16384 ? "high" : b <= 4096 ? "low" : "medium";
      }
    }
  }

  // Fork: meta-models with thinking tiers route to their backend tier model
  const baseFound = findModel(models, baseId, aliasOrId);
  const metaEntry = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const tiers = baseFound?.thinkingTiers || metaEntry?.tiers || metaEntry;
  if (tiers) {
    const rawLevel = rawSuffix || thinkingLevel || tier || null;
    const targetModelId = resolveThinkingTier(tiers, rawLevel);
    if (targetModelId && targetModelId !== baseId) {
      return getModelUpstreamId(aliasOrId, targetModelId);
    }
  }

  // Look for tiered variant first if a tier was requested (e.g. gemini-3.8-flash-high)
  const tieredId = tier ? `${baseId}-${tier}` : null;
  const found = (tieredId && findModel(models, tieredId, aliasOrId)) || baseFound;
  const resolvedId = found?.upstreamModelId || found?.id;
  if (resolvedId) {
    const presetMatch = resolvedId.match(/\([^()]+\)\s*$/);
    const presetSuffix = presetMatch?.[0] || "";
    const resolvedBase = presetSuffix ? resolvedId.slice(0, presetMatch.index).trim() : resolvedId;
    return resolvedBase + (suffix || (presetSuffix && tier ? `(${tier})` : presetSuffix));
  }
  if (
    aliasOrId === "cx" &&
    typeof baseId === "string" &&
    baseId.endsWith(CODEX_REVIEW_SUFFIX)
  ) {
    return baseId.slice(0, -CODEX_REVIEW_SUFFIX.length) + suffix;
  }
  return baseId + suffix;
}

export function getModelQuotaFamily(aliasOrId, modelId) {
  const models = PROVIDER_MODELS[aliasOrId];
  return modelQuotaFamily(findModel(models, modelId, aliasOrId));
}

// OAuth short aliases — derived from registry `alias` (single source). everything else: alias = id.
// vertex/vertex-partner keep alias=id (kept via the `|| id` fallback in consumers).
export const OAUTH_ALIASES = Object.fromEntries(
  REGISTRY.filter((r) => r.alias && r.alias !== r.id).map((r) => [
    r.id,
    r.alias,
  ]),
);

// Derived from REGISTRY — no need to maintain manually. REGISTRY (not PROVIDERS):
// media-only entries (elevenlabs, cartesia, inworld, ...) declare no transport, so
// keying off PROVIDERS dropped their alias and made their registry `models`
// unreachable — the exact same map PROVIDER_MODELS is keyed by
// (`entry.alias || entry.id` in providers/index.js).
export const PROVIDER_ID_TO_ALIAS = Object.fromEntries(
  REGISTRY.map(r => [r.id, r.alias || r.id])
);

// Sync meta-models into PROVIDER_MODELS and hide internal tier target models
for (const [providerId, metaMap] of Object.entries(PROVIDER_META_MODELS)) {
  const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  const models = PROVIDER_MODELS[alias] || PROVIDER_MODELS[providerId];
  if (!models) continue;

  const tierTargetIds = new Set();
  for (const [id, meta] of Object.entries(metaMap)) {
    const tiers = meta.tiers || meta;
    for (const targetId of Object.values(tiers)) {
      if (typeof targetId === "string") {
        tierTargetIds.add(targetId);
      }
    }
    // Add base meta-model if not already in models list
    if (!models.some((m) => m.id === id)) {
      const entry = {
        id,
        name: meta.name || id,
        thinkingTiers: tiers,
      };
      if (meta.hidden) entry.hidden = true;
      models.push(entry);
    }
  }

  // Mark tier target models as hidden so they do not clutter UI / discovery
  for (const m of models) {
    if (tierTargetIds.has(m.id) && !metaMap[m.id]) {
      m.hidden = true;
    }
  }
}

export function getModelsByProviderId(providerId) {
  const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  return PROVIDER_MODELS[alias] || [];
}

// Get strip list for a model entry (explicit opt-in only)
// Returns array of content types to strip, e.g. ["image", "audio"]
export function getModelStrip(alias, modelId) {
  return modelStrip(findModel(PROVIDER_MODELS[alias], modelId, alias));
}
