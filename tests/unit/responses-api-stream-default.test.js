/**
 * Tests that /v1/responses (Responses API) defaults to non-streaming,
 * matching the OpenAI spec. Clients like DBeaver expect JSON by default;
 * they must explicitly send stream:true to get SSE.
 *
 * Contrast with /v1/chat/completions which defaults to streaming (9router's
 * stream-first architecture — historical default, not OpenAI-spec-compliant).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock("../../open-sse/executors/index.js", () => ({
  getExecutor: vi.fn(() => ({
    execute: executeMock,
    refreshCredentials: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock("../../open-sse/utils/requestLogger.js", () => ({
  createRequestLogger: vi.fn(async () => ({
    logClientRawRequest: vi.fn(),
    logRawRequest: vi.fn(),
    logTargetRequest: vi.fn(),
    logError: vi.fn(),
  })),
}));

vi.mock("../../open-sse/utils/clientDetector.js", () => ({
  detectClientTool: vi.fn(() => null),
  isNativePassthrough: vi.fn(() => false),
}));

vi.mock("../../open-sse/utils/bypassHandler.js", () => ({
  handleBypassRequest: vi.fn(() => null),
}));

vi.mock("../../open-sse/utils/streamHandler.js", () => ({
  createStreamController: vi.fn(() => ({
    signal: undefined,
    handleComplete: vi.fn(),
    handleError: vi.fn(),
  })),
}));

vi.mock("../../open-sse/services/tokenRefresh.js", () => ({
  refreshWithRetry: vi.fn(),
}));

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  default: vi.fn(),
  proxyAwareFetch: vi.fn(),
}));

vi.mock("../../open-sse/translator/formats/claude.js", () => ({
  normalizeClaudePassthrough: vi.fn(),
}));

vi.mock("../../open-sse/utils/toolDeduper.js", () => ({
  dedupeTools: vi.fn((tools) => ({ tools, stripped: [] })),
}));

vi.mock("../../open-sse/rtk/caveman.js", () => ({
  injectCaveman: vi.fn(),
}));

vi.mock("../../open-sse/rtk/ponytail.js", () => ({
  injectPonytail: vi.fn(),
}));

vi.mock("../../open-sse/rtk/index.js", () => ({
  compressMessages: vi.fn(() => null),
  formatRtkLog: vi.fn(() => ""),
}));

vi.mock("../../open-sse/rtk/headroom.js", () => ({
  compressWithHeadroom: vi.fn(async () => null),
  formatHeadroomLog: vi.fn(() => ""),
  formatHeadroomSizeLog: vi.fn(() => ""),
  isHeadroomPhantomSavings: vi.fn(() => false),
}));

vi.mock("../../open-sse/providers/capabilities.js", () => ({
  getCapabilitiesForModel: vi.fn(() => ({})),
}));

vi.mock("../../open-sse/translator/concerns/modality.js", () => ({
  stripUnsupportedModalities: vi.fn(() => false),
}));

vi.mock("../../open-sse/translator/concerns/prefetch.js", () => ({
  prefetchRemoteImages: vi.fn(async () => 0),
}));

vi.mock("../../open-sse/handlers/chatCore/requestDetail.js", () => ({
  buildRequestDetail: vi.fn((detail) => detail),
  extractRequestConfig: vi.fn((body, stream) => ({ body, stream })),
  extractUsageFromResponse: vi.fn(() => ({})),
  saveUsageStats: vi.fn(),
}));

vi.mock("../../open-sse/utils/error.js", () => ({
  createErrorResult: vi.fn((status, message) => ({ success: false, status, error: message })),
  formatProviderError: vi.fn((error) => error.message),
  parseUpstreamError: vi.fn(),
}));

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(() => Promise.resolve()),
  saveRequestDetail: vi.fn(() => Promise.resolve()),
}));

const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ─── Responses API requests (/v1/responses) ────────────────────────────────

function makeResponsesApiOptions(bodyStream) {
  const body = {
    model: "ocg/deepseek-v4-flash",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] }],
  };
  if (bodyStream !== undefined) body.stream = bodyStream;

  return {
    body,
    modelInfo: { provider: "openrouter-compatible", model: "deepseek-v4-flash" },
    credentials: { apiKey: "sk-test" },
    clientRawRequest: {
      endpoint: "/v1/responses",
      body,
      headers: {},
    },
    connectionId: "test-conn",
    log: silentLog,
    sourceFormatOverride: "openai-responses",
  };
}

// ─── Chat Completions requests (/v1/chat/completions) ───────────────────────

function makeChatCompletionsOptions(bodyStream) {
  const body = {
    model: "ocg/deepseek-v4-flash",
    messages: [{ role: "user", content: "hello" }],
  };
  if (bodyStream !== undefined) body.stream = bodyStream;

  return {
    body,
    modelInfo: { provider: "openrouter-compatible", model: "deepseek-v4-flash" },
    credentials: { apiKey: "sk-test" },
    clientRawRequest: {
      endpoint: "/v1/chat/completions",
      body,
      headers: {},
    },
    connectionId: "test-conn",
    log: silentLog,
  };
}

describe("Responses API (/v1/responses) — stream default", () => {
  beforeEach(() => {
    executeMock.mockReset();
    // Let execute throw so we can inspect args without needing full response handling
    executeMock.mockRejectedValue(new Error("test-abort"));
  });

  it("defaults to non-streaming when stream is omitted", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeResponsesApiOptions(undefined));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(false);
  });

  it("defaults to non-streaming when stream is explicitly false", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeResponsesApiOptions(false));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(false);
  });

  it("streams when stream is explicitly true", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeResponsesApiOptions(true));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(true);
  });

  it("defaults to non-streaming when stream is null (no preference = spec default)", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeResponsesApiOptions(null));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(false);
  });
});

describe("Chat Completions (/v1/chat/completions) — stream default", () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockRejectedValue(new Error("test-abort"));
  });

  it("defaults to streaming when stream is omitted (9router historical default)", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeChatCompletionsOptions(undefined));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(true);
  });

  it("does not stream when stream is explicitly false", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeChatCompletionsOptions(false));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(false);
  });

  it("streams when stream is explicitly true", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    await handleChatCore(makeChatCompletionsOptions(true));

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].stream).toBe(true);
  });
});

describe("Responses API + forceStream provider", () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockRejectedValue(new Error("test-abort"));
  });

  it("forceStream provider still streams even for Responses API (provider wins)", async () => {
    const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
    // OpenAI provider has forceStream=true
    const opts = makeResponsesApiOptions(undefined);
    opts.modelInfo = { provider: "openai", model: "gpt-4.1" };
    opts.body.model = "openai/gpt-4.1";

    await handleChatCore(opts);

    expect(executeMock).toHaveBeenCalledTimes(1);
    // forceStream should override the Responses API default
    expect(executeMock.mock.calls[0][0].stream).toBe(true);
  });
});
