import { describe, expect, it } from "vitest";
import {
  getModelUpstreamId,
  resolveThinkingTier,
  getModelsByProviderId,
} from "../../open-sse/config/providerModels.js";
import { isValidModel, AI_MODELS } from "../../src/shared/constants/models.js";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";
import {
  applyThinking,
  stripThinkingSuffix,
} from "../../open-sse/translator/concerns/thinkingUnified.js";

describe("resolveThinkingTier", () => {
  const tiers = {
    high: "model-high",
    medium: "model-medium",
    low: "model-low",
    none: "model-none",
    default: "model-medium",
  };

  it("maps discrete levels to correct tier", () => {
    expect(resolveThinkingTier(tiers, "high")).toBe("model-high");
    expect(resolveThinkingTier(tiers, "xhigh")).toBe("model-high");
    expect(resolveThinkingTier(tiers, "max")).toBe("model-high");
    expect(resolveThinkingTier(tiers, "ultra")).toBe("model-high");
    expect(resolveThinkingTier(tiers, "medium")).toBe("model-medium");
    expect(resolveThinkingTier(tiers, "low")).toBe("model-low");
    expect(resolveThinkingTier(tiers, "minimal")).toBe("model-low");
    expect(resolveThinkingTier(tiers, "none")).toBe("model-none");
    expect(resolveThinkingTier(tiers, "off")).toBe("model-none");
    expect(resolveThinkingTier(tiers, "disabled")).toBe("model-none");
  });

  it("defaults when level is missing or null", () => {
    expect(resolveThinkingTier(tiers, null)).toBe("model-medium");
    expect(resolveThinkingTier(tiers, undefined)).toBe("model-medium");
    expect(resolveThinkingTier(tiers, "auto")).toBe("model-medium");
  });

  it("maps numeric token budgets to tiers", () => {
    expect(resolveThinkingTier(tiers, 1024)).toBe("model-low");
    expect(resolveThinkingTier(tiers, 4096)).toBe("model-low");
    expect(resolveThinkingTier(tiers, 8192)).toBe("model-medium");
    expect(resolveThinkingTier(tiers, 24576)).toBe("model-high");
  });
});

describe("Antigravity meta-model upstream ID mapping", () => {
  it("maps gemini-3.8-flash to tiered models based on thinking level", () => {
    expect(getModelUpstreamId("ag", "gemini-3.8-flash", "high")).toBe(
      "gemini-3.8-flash-high(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.8-flash", "medium")).toBe(
      "gemini-3.8-flash-medium(medium)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.8-flash", "low")).toBe(
      "gemini-3.8-flash-low(low)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.8-flash", null)).toBe(
      "gemini-3.8-flash-medium(medium)",
    );
  });

  it("maps gemini-3.8-flash with suffix in model name", () => {
    expect(getModelUpstreamId("ag", "gemini-3.8-flash(high)")).toBe(
      "gemini-3.8-flash-high(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.8-flash(low)")).toBe(
      "gemini-3.8-flash-low(low)",
    );
  });

  it("maps gemini-3.7-flash to tiered models based on thinking level", () => {
    expect(getModelUpstreamId("ag", "gemini-3.7-flash", "high")).toBe(
      "gemini-3.7-flash-tiered(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.7-flash", "medium")).toBe(
      "gemini-3.7-flash-tiered(medium)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.7-flash", "low")).toBe(
      "gemini-3.7-flash-tiered(low)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.7-flash", null)).toBe(
      "gemini-3.7-flash-tiered(medium)",
    );
  });

  it("maps gemini-3.6-flash to tiered models based on thinking level", () => {
    expect(getModelUpstreamId("ag", "gemini-3.6-flash", "high")).toBe(
      "gemini-3.6-flash-tiered(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.6-flash", "medium")).toBe(
      "gemini-3.6-flash-tiered(medium)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.6-flash", "low")).toBe(
      "gemini-3.6-flash-tiered(low)",
    );
  });

  it("maps gemini-3.5-flash to tiered models", () => {
    expect(getModelUpstreamId("ag", "gemini-3.5-flash", "high")).toBe(
      "gemini-3.5-flash-high",
    );
    expect(getModelUpstreamId("ag", "gemini-3.5-flash", "medium")).toBe(
      "gemini-3.5-flash-low",
    );
    expect(getModelUpstreamId("ag", "gemini-3.5-flash", "low")).toBe(
      "gemini-3.5-flash-extra-low",
    );
  });

  it("maps gemini-3.1-pro to agent vs low", () => {
    expect(getModelUpstreamId("ag", "gemini-3.1-pro", "high")).toBe(
      "gemini-pro-agent",
    );
    expect(getModelUpstreamId("ag", "gemini-3.1-pro", "low")).toBe(
      "gemini-3.1-pro-low",
    );
  });

  it("maps claude-opus-4-6 to thinking vs non-thinking", () => {
    expect(getModelUpstreamId("ag", "claude-opus-4-6", "high")).toBe(
      "claude-opus-4-6-thinking",
    );
    expect(getModelUpstreamId("ag", "claude-opus-4-6", "none")).toBe(
      "claude-opus-4-6",
    );
    expect(getModelUpstreamId("ag", "claude-opus-4-6", null)).toBe(
      "claude-opus-4-6-thinking",
    );
  });

  it("leaves explicitly specified tiered models untouched", () => {
    expect(getModelUpstreamId("ag", "gemini-3.8-flash-high")).toBe(
      "gemini-3.8-flash-high(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.7-flash-high")).toBe(
      "gemini-3.7-flash-tiered(high)",
    );
    expect(getModelUpstreamId("ag", "gemini-3.6-flash-low")).toBe(
      "gemini-3.6-flash-tiered(low)",
    );
  });
});

describe("Antigravity meta-model executor integration", () => {
  it("resolves gemini-3.8-flash high effort into proper upstream model and thinkingConfig", () => {
    const upstreamModel = getModelUpstreamId("ag", "gemini-3.8-flash", "high");
    const body = {
      model: stripThinkingSuffix(upstreamModel),
      request: {
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
        generationConfig: {},
      },
    };

    applyThinking("antigravity", upstreamModel, body, "antigravity");
    const finalBody = new AntigravityExecutor().transformRequest(
      "gemini-3.8-flash",
      body,
      true,
      { projectId: "project", connectionId: "connection" },
    );

    expect(upstreamModel).toBe("gemini-3.8-flash-high(high)");
    expect(finalBody.model).toBe("gemini-3.8-flash-high");
    expect(finalBody.request.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: "high",
      includeThoughts: true,
    });
  });

  it("resolves gemini-3.7-flash low effort into proper upstream model and thinkingConfig", () => {
    const upstreamModel = getModelUpstreamId("ag", "gemini-3.7-flash", "low");
    const body = {
      model: stripThinkingSuffix(upstreamModel),
      request: {
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
        generationConfig: {},
      },
    };

    applyThinking("antigravity", upstreamModel, body, "antigravity");
    const finalBody = new AntigravityExecutor().transformRequest(
      "gemini-3.7-flash",
      body,
      true,
      { projectId: "project", connectionId: "connection" },
    );

    expect(upstreamModel).toBe("gemini-3.7-flash-tiered(low)");
    expect(finalBody.model).toBe("gemini-3.7-flash-tiered");
    expect(finalBody.request.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: "low",
      includeThoughts: true,
    });
  });
});

describe("Antigravity meta-models discovery and visibility", () => {
  it("exposes clean base models as visible and marks tier targets as hidden", () => {
    const agModels = getModelsByProviderId("antigravity");
    const visibleIds = agModels.filter((m) => !m.hidden).map((m) => m.id);
    const hiddenIds = agModels.filter((m) => m.hidden).map((m) => m.id);

    // Visible base models
    expect(visibleIds).toContain("gemini-3.8-flash");
    expect(visibleIds).toContain("gemini-3.7-flash");
    expect(visibleIds).toContain("gemini-3.6-flash");
    expect(visibleIds).toContain("gemini-3.5-flash");
    expect(visibleIds).toContain("gemini-3.1-pro");
    expect(visibleIds).toContain("claude-opus-4-6");

    // Hidden backend tier targets and dot aliases
    expect(hiddenIds).toContain("gemini-3.8-flash-high");
    expect(hiddenIds).toContain("gemini-3.8-flash-medium");
    expect(hiddenIds).toContain("gemini-3.8-flash-low");
    expect(hiddenIds).toContain("gemini-3.7-flash-high");
    expect(hiddenIds).toContain("gemini-3.7-flash-medium");
    expect(hiddenIds).toContain("gemini-3.7-flash-low");
    expect(hiddenIds).toContain("claude-opus-4-6-thinking");
    expect(hiddenIds).toContain("claude-opus-4.6");
  });

  it("validates both base models and tiered models", () => {
    expect(isValidModel("ag", "gemini-3.8-flash")).toBe(true);
    expect(isValidModel("ag", "gemini-3.8-flash-high")).toBe(true);
    expect(isValidModel("ag", "gemini-3.7-flash")).toBe(true);
    expect(isValidModel("ag", "gemini-3.7-flash-low")).toBe(true);
    expect(isValidModel("ag", "claude-opus-4-6")).toBe(true);
    expect(isValidModel("ag", "claude-opus-4-6-thinking")).toBe(true);
  });

  it("filters hidden tier models out of AI_MODELS", () => {
    const agAiModels = AI_MODELS.filter(
      (m) => m.provider === "ag" || m.provider === "antigravity",
    );
    const ids = agAiModels.map((m) => m.model);

    expect(ids).toContain("gemini-3.8-flash");
    expect(ids).toContain("gemini-3.7-flash");
    expect(ids).toContain("claude-opus-4-6");
    expect(ids).not.toContain("gemini-3.8-flash-high");
    expect(ids).not.toContain("claude-opus-4-6-thinking");
  });
});
