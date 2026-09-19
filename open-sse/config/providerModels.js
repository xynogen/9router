import { PROVIDERS } from "./providers.js";
import REGISTRY from "../providers/registry/index.js";
// PROVIDER_MODELS now built from providers/registry (transport + models co-located)
import { PROVIDER_MODELS } from "../providers/index.js";
import {
  modelQuotaFamily,
  modelStrip,
  modelTargetFormat,
  modelSupportedFormats,
  normalizeModelId,
} from "../providers/models/schema.js";
import {
  CODEX_REVIEW_SUFFIX,
  isMuseSparkModel,
} from "../providers/models/helpers.js";
import { FORMATS } from "../translator/formats.js";
export { PROVIDER_MODELS };

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
  if (
    (!aliasOrId ||
      aliasOrId === "oc" ||
      aliasOrId === "opencode" ||
      aliasOrId === "ocg" ||
      aliasOrId === "opencode-go") &&
    isMuseSparkModel(modelId)
  ) {
    return FORMATS.OPENAI_RESPONSES;
  }
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return null;
  const baseId =
    typeof modelId === "string"
      ? modelId.replace(/\([^()]+\)\s*$/, "").trim()
      : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const targetId = meta?.tiers?.default || meta?.default || baseId;
  return modelTargetFormat(findModel(models, targetId, aliasOrId));
}

// Declared upstream formats for a model (registry `supportedFormats`). Drives the
// per-model guard on the sourceFormat-matched transport; null when undeclared.
export function getModelSupportedFormats(aliasOrId, modelId) {
  const models = PROVIDER_MODELS[aliasOrId];
  if (!models) return null;
  const baseId =
    typeof modelId === "string"
      ? modelId.replace(/\([^()]+\)\s*$/, "").trim()
      : modelId;
  const meta = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const targetId = meta?.tiers?.default || meta?.default || baseId;
  return modelSupportedFormats(findModel(models, targetId, aliasOrId));
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

export function getModelUpstreamId(aliasOrId, modelId, thinkingLevel = null) {
  // Split off thinking suffix "(level)" so lookup hits the base id; re-append it to
  // the result so downstream applyThinking still sees the suffix (body.model is stripped separately).
  const sufMatch =
    typeof modelId === "string" ? modelId.match(/\([^()]+\)\s*$/) : null;
  const suffix = sufMatch ? sufMatch[0] : "";
  const baseId = suffix ? modelId.slice(0, sufMatch.index).trim() : modelId;
  const models = PROVIDER_MODELS[aliasOrId];
  const found = findModel(models, baseId, aliasOrId);

  // Check if this model is a meta-model with thinking tiers
  const metaEntry = PROVIDER_META_MODELS[aliasOrId]?.[baseId];
  const tiers = found?.thinkingTiers || metaEntry?.tiers || metaEntry;
  if (tiers) {
    const rawLevel = sufMatch
      ? sufMatch[0].slice(1, -1).trim().toLowerCase()
      : thinkingLevel;
    const targetModelId = resolveThinkingTier(tiers, rawLevel);
    if (targetModelId && targetModelId !== baseId) {
      return getModelUpstreamId(
        aliasOrId,
        targetModelId + (sufMatch ? "" : suffix),
      );
    }
  }

  const resolvedId = found?.upstreamModelId || found?.id;
  if (resolvedId) {
    const presetMatch = resolvedId.match(/\([^()]+\)\s*$/);
    const presetSuffix = presetMatch?.[0] || "";
    const resolvedBase = presetSuffix
      ? resolvedId.slice(0, presetMatch.index).trim()
      : resolvedId;
    return resolvedBase + (suffix || presetSuffix);
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

// Derived from PROVIDERS — no need to maintain manually
export const PROVIDER_ID_TO_ALIAS = Object.fromEntries(
  Object.keys(PROVIDERS).map((id) => [id, OAUTH_ALIASES[id] || id]),
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
      models.push({
        id,
        name: meta.name || id,
        thinkingTiers: tiers,
      });
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
