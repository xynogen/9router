import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    // Keep model-list tests independent of the upstream catalog.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    mocks.getCombos.mockResolvedValue([]);
    mocks.getCustomModels.mockResolvedValue([]);
    mocks.getModelAliases.mockResolvedValue({});
    mocks.getDisabledModels.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllGlobals());

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
        "union-alpha",
        "jev-1.13-free",
      ],
    });

    const models = await buildModelsList(["llm"]);
    const opencodeModels = models.filter((m) => m.id.startsWith("oc/"));

    expect(opencodeModels).toHaveLength(0);
  });

  it.each([true, false])("only lists enabled dashboard chat models (active connection: %s)", async (connected) => {
    mocks.getProviderConnections.mockResolvedValue(connected ? [
      { id: "openai-1", provider: "openai", isActive: true },
    ] : []);
    const disabled = ["muse-spark-1.2-contributor-free", "muse-spark-1.3-contributor-free", "union-alpha"];
    mocks.getDisabledModels.mockResolvedValue({ oc: disabled });
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({
      data: [
        { id: "big-pickle", limit: { context: 220_000 } },
        { id: "hy4-flash-free" },
        { id: "jev-1.13-free" },
      ],
    })));

    const openCodeModels = async () => (await buildModelsList(["llm"]))
      .filter((model) => model.id.startsWith("oc/"));

    expect(await openCodeModels()).toEqual([]);

    mocks.getCustomModels.mockResolvedValue([{ providerAlias: "oc", id: "big-pickle", type: "llm" }]);
    expect(await openCodeModels()).toMatchObject([{ id: "oc/big-pickle", context_length: 220_000 }]);

    mocks.getDisabledModels.mockResolvedValue({ oc: [...disabled, "big-pickle"] });
    expect(await openCodeModels()).toEqual([]);

    mocks.getDisabledModels.mockResolvedValue({});
    const restoredIds = (await openCodeModels()).map((model) => model.id);
    expect(restoredIds).toContain("oc/big-pickle");
    expect(restoredIds).toContain("oc/union-alpha");
    expect(restoredIds).not.toContain("oc/hy4-flash-free");
  });
});
