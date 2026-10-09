import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import fs from "node:fs";

const { adapter } = vi.hoisted(() => ({ adapter: { all: vi.fn() } }));
vi.mock("../../src/lib/db/driver.js", () => ({ getAdapter: async () => adapter }));
vi.mock("../../src/lib/db/repos/connectionsRepo.js", () => ({ getProviderConnections: async () => [] }));
vi.mock("../../src/lib/db/repos/apiKeysRepo.js", () => ({ getApiKeys: async () => [] }));
vi.mock("../../src/lib/db/repos/nodesRepo.js", () => ({ getProviderNodes: async () => [] }));
import { getUsageHistory, getUsageStats } from "../../src/lib/db/repos/usageRepo.js";

// ============================================================
// AUDIT-002 (#1962): API key masking in usage stats
// ============================================================
describe("AUDIT-002: API key masking", () => {
  const apiKeys = ["sk-machine-aaaaaa-11111111", "sk-machine-bbbbbb-22222222"];
  const maskedKeys = ["sk-machi***1111", "sk-machi***2222"];
  const rows = apiKeys.map((apiKey) => ({
    apiKey, model: "gpt-4", provider: "openai", timestamp: new Date().toISOString(),
    tokens: JSON.stringify({ prompt_tokens: 10, completion_tokens: 5 }),
  }));

  beforeEach(() => {
    adapter.all.mockImplementation((sql) => {
      if (sql.includes("FROM usageDaily")) {
        return [{ dateKey: rows[0].timestamp.slice(0, 10), data: JSON.stringify({
          byApiKey: Object.fromEntries(rows.map((r) => [
            `${r.apiKey}|${r.model}|${r.provider}`,
            { apiKey: r.apiKey, rawModel: r.model, provider: r.provider, requests: 1 },
          ])),
        }) }];
      }
      return rows;
    });
  });

  it("history returns masked keys without raw API keys", async () => {
    const history = await getUsageHistory();
    expect(history.map((r) => r.apiKeyMasked)).toEqual(maskedKeys);
    for (const apiKey of apiKeys) expect(JSON.stringify(history)).not.toContain(apiKey);
  });

  it("history masks short keys and handles absent keys", async () => {
    adapter.all.mockReturnValue([{ apiKey: "short-key" }, { apiKey: null }]);
    expect((await getUsageHistory()).map((r) => r.apiKeyMasked)).toEqual(["s***", null]);
  });

  for (const period of ["24h", "all"]) {
    it(`${period} stats retain separate buckets with masked display fields`, async () => {
      const entries = Object.values((await getUsageStats(period)).byApiKey);
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.apiKeyMasked)).toEqual(maskedKeys);
      expect(entries.map((e) => e.apiKeyKey)).toEqual(maskedKeys);
      for (const entry of entries) expect(entry).not.toHaveProperty("apiKey");
    });

    it(`${period} serialized stats must not leak raw keys through object keys`, async () => {
      // getUsageStats is serialized directly by the usage routes and SSE stream.
      const stats = await getUsageStats(period);
      for (const apiKey of apiKeys) expect(JSON.stringify(stats)).not.toContain(apiKey);
    });
  }
});

// ============================================================
// AUDIT-003 (#1961): Proxy URL validation
// ============================================================
describe("AUDIT-003: Proxy URL validation", () => {
  beforeEach(() => {
    vi.stubEnv("HTTP_PROXY", undefined);
    vi.stubEnv("HTTPS_PROXY", undefined);
    vi.stubEnv("ALL_PROXY", undefined);
    vi.stubEnv("NINE_ROUTER_PROXY_MANAGED", undefined);
    vi.stubEnv("NINE_ROUTER_PROXY_URL", undefined);
    vi.stubEnv("NINE_ROUTER_NO_PROXY", undefined);
    vi.stubEnv("NO_PROXY", undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("source should contain validateProxyUrl function", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/lib/network/outboundProxy.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("function validateProxyUrl");
    expect(source).toContain("ALLOWED_PROXY_SCHEMES");
  });

  it("should accept valid http proxy URLs", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "http://proxy.example.com:8080",
    });
    // new URL().href normalizes (adds trailing slash)
    expect(process.env.HTTP_PROXY).toContain("http://proxy.example.com:8080");
    expect(process.env.HTTPS_PROXY).toContain("http://proxy.example.com:8080");
  });

  it("should accept valid https proxy URLs", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "https://proxy.example.com:443",
    });
    // new URL().href normalizes (drops default port 443, adds trailing slash)
    expect(process.env.HTTP_PROXY).toContain("https://proxy.example.com");
  });

  it("should accept valid socks5 proxy URLs", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "socks5://proxy.example.com:1080",
    });
    expect(process.env.ALL_PROXY).toBe("socks5://proxy.example.com:1080");
  });

  it("should reject URLs with shell metacharacters (newline)", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "http://proxy.example.com:8080\nmalicious",
    });
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });

  it("should reject URLs with shell metacharacters (backtick)", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "http://`whoami`.example.com:8080",
    });
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });

  it("should reject URLs with shell metacharacters (dollar)", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "http://$(whoami).example.com:8080",
    });
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });

  it("should reject non-allowed schemes (file://)", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "file:///etc/passwd",
    });
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });

  it("should reject non-allowed schemes (javascript:)", async () => {
    vi.resetModules();
    const { applyOutboundProxyEnv } = await import("../../src/lib/network/outboundProxy.js");
    applyOutboundProxyEnv({
      outboundProxyEnabled: true,
      outboundProxyUrl: "javascript:alert(1)",
    });
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });
});

// ============================================================
// AUDIT-018 (#1972): XSS escaping in OAuth callback
// ============================================================
describe("AUDIT-018: XSS escaping in OAuth callback", () => {
  it("source should contain escapeHtml function", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/lib/oauth/utils/server.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("function escapeHtml");
  });

  it("should escape ampersand, angle brackets, and quotes", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/lib/oauth/utils/server.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("&amp;");
    expect(source).toContain("&lt;");
    expect(source).toContain("&gt;");
    expect(source).toContain("&quot;");
    expect(source).toContain("&#39;");
  });

  it("should use safeMessage in rendered HTML, not raw message", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/lib/oauth/utils/server.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("safeMessage");
    expect(source).toContain("${safeMessage}");
    // Should NOT use raw message in HTML body
    expect(source).not.toContain("<p>${message}</p>");
  });
});

// ============================================================
// AUDIT-004 (#1963): TOCTOU race - atomic lock file
// ============================================================
describe("AUDIT-004: Atomic lock file for MITM startup", () => {
  it("manager.js should define LOCK_FILE constant", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/mitm/manager.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain("LOCK_FILE");
    expect(source).toContain(".mitm.lock");
  });

  it("should use O_EXCL flag (wx) for atomic creation", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/mitm/manager.js", import.meta.url),
      "utf-8"
    );
    expect(source).toContain('"wx"');
    expect(source).toContain("EEXIST");
  });

  it("should clean up lock file on all exit paths", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/mitm/manager.js", import.meta.url),
      "utf-8"
    );
    const matches = source.match(/unlinkSync\(LOCK_FILE\)/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================
// AUDIT-001 (#1965): Race condition in retry tracking
// ============================================================
describe("AUDIT-001: Synchronous restart guard", () => {
  it("mitmIsRestarting should be set before first await expression", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/mitm/manager.js", import.meta.url),
      "utf-8"
    );

    const funcStart = source.indexOf("async function scheduleMitmRestart");
    expect(funcStart).toBeGreaterThan(-1);

    const funcBody = source.substring(funcStart, funcStart + 2000);

    const guardCheckIdx = funcBody.indexOf("if (mitmIsRestarting) return;");
    expect(guardCheckIdx).toBeGreaterThan(-1);

    const afterGuard = funcBody.substring(guardCheckIdx);

    // Strip line comments to avoid matching "await" in comment text
    const noComments = afterGuard.replace(/\/\/.*$/gm, "");

    // Find the first actual await expression
    const firstAwaitIdx = noComments.search(/\bawait\s+/);
    expect(firstAwaitIdx).toBeGreaterThan(-1);

    // Find mitmIsRestarting = true
    const setFlagIdx = noComments.indexOf("mitmIsRestarting = true");

    expect(setFlagIdx).toBeGreaterThan(-1);
    expect(firstAwaitIdx).toBeGreaterThan(-1);
    expect(setFlagIdx).toBeLessThan(firstAwaitIdx);
  });

  it("mitmIsRestarting should be reset on max-restarts early return", () => {
    const source = fs.readFileSync(
      new URL("../../" + "src/mitm/manager.js", import.meta.url),
      "utf-8"
    );

    const funcStart = source.indexOf("async function scheduleMitmRestart");
    const funcBody = source.substring(funcStart, funcStart + 2000);

    const maxRestartsIdx = funcBody.indexOf("Max restart attempts reached");
    expect(maxRestartsIdx).toBeGreaterThan(-1);

    const afterMax = funcBody.substring(maxRestartsIdx, maxRestartsIdx + 200);
    expect(afterMax).toContain("mitmIsRestarting = false");
  });
});
