import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn().mockResolvedValue([]),
  getCustomModels: vi.fn().mockResolvedValue([]),
  getModelAliases: vi.fn().mockResolvedValue({}),
  getDisabledModels: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  getCombos: mocks.getCombos,
  getCustomModels: mocks.getCustomModels,
  getModelAliases: mocks.getModelAliases,
}));

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: mocks.getDisabledModels,
}));

const { buildModelsList } = await import(
  "../../src/app/api/v1/models/route.js"
);

describe("buildModelsList with noAuth providers (OpenCode Free)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCombos.mockResolvedValue([]);
    mocks.getCustomModels.mockResolvedValue([]);
    mocks.getModelAliases.mockResolvedValue({});
    mocks.getDisabledModels.mockResolvedValue({});
  });

  it("includes OpenCode Free models when other provider connections are active", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      { id: "openai-1", provider: "openai", apiKey: "sk-test", isActive: true },
    ]);

    const models = await buildModelsList(["llm"]);
    const opencodeModels = models.filter((m) => m.id.startsWith("oc/"));

    expect(opencodeModels.length).toBeGreaterThanOrEqual(2);
    expect(
      opencodeModels.some((m) => m.id === "oc/muse-spark-1.2-contributor-free"),
    ).toBe(true);
    expect(
      opencodeModels.some((m) => m.id === "oc/muse-spark-1.3-contributor-free"),
    ).toBe(true);

    const model = opencodeModels.find(
      (m) => m.id === "oc/muse-spark-1.2-contributor-free",
    );
    expect(model.owned_by).toBe("oc");
    expect(model.capabilities).toBeDefined();
    expect(model.capabilities.reasoning).toBe(true);
  });

  it("respects disabledModels for OpenCode Free models", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      { id: "openai-1", provider: "openai", apiKey: "sk-test", isActive: true },
    ]);
    mocks.getDisabledModels.mockResolvedValue({
      oc: ["muse-spark-1.2-contributor-free"],
    });

    const models = await buildModelsList(["llm"]);
    const opencodeModels = models.filter((m) => m.id.startsWith("oc/"));

    expect(
      opencodeModels.some((m) => m.id === "oc/muse-spark-1.2-contributor-free"),
    ).toBe(false);
    expect(
      opencodeModels.some((m) => m.id === "oc/muse-spark-1.3-contributor-free"),
    ).toBe(true);
  });

  it("omits all OpenCode Free models if all are disabled", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      { id: "openai-1", provider: "openai", apiKey: "sk-test", isActive: true },
    ]);
    mocks.getDisabledModels.mockResolvedValue({
      oc: [
        "muse-spark-1.2-contributor-free",
        "muse-spark-1.3-contributor-free",
      ],
    });

    const models = await buildModelsList(["llm"]);
    const opencodeModels = models.filter((m) => m.id.startsWith("oc/"));

    expect(opencodeModels).toHaveLength(0);
  });
});
