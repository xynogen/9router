import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http2 from "http2";

vi.mock("http2", () => ({ default: { connect: vi.fn() } }));
import {
  clearCursorModelCache,
  parseCursorUsableModels,
  resolveCursorModels,
} from "../../open-sse/services/cursorModels.js";

let client;
let request;
let responseStatus;
let responsePayload;

function varint(value) {
  const bytes = [];
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return Uint8Array.from(bytes);
}

function field(fieldNumber, value) {
  return Uint8Array.from([(fieldNumber << 3) | 2, ...varint(value.length), ...value]);
}

function text(value) {
  return new TextEncoder().encode(value);
}

function concat(...parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function model(id, name) {
  return field(1, concat(field(1, text(id)), field(4, text(name))));
}

describe("Cursor live model catalog", () => {
  beforeEach(() => {
    clearCursorModelCache();
    responseStatus = 200;
    responsePayload = new Uint8Array();
    client = new EventEmitter();
    request = new EventEmitter();
    client.close = vi.fn();
    client.request = vi.fn(() => request);
    request.end = vi.fn(() => queueMicrotask(() => {
      request.emit("response", { ":status": responseStatus });
      request.emit("data", Buffer.from(responsePayload));
      request.emit("end");
    }));
    vi.mocked(http2.connect).mockReturnValue(client);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Cursor catalog must use HTTP/2"); }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearCursorModelCache();
  });

  it("decodes the GetUsableModels protobuf response", () => {
    const payload = concat(
      model("default", "Auto"),
      model("gpt-5.3-codex", "GPT 5.3 Codex"),
      model("gpt-5.3-codex", "Duplicate"),
    );

    expect(parseCursorUsableModels(payload)).toEqual([
      { id: "default", name: "Auto" },
      { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
    ]);
  });

  it("fetches the account-specific catalog and caches it", async () => {
    responsePayload = concat(model("claude-4.6-opus", "Claude 4.6 Opus"));
    const credentials = {
      accessToken: "cursor-token",
      providerSpecificData: { machineId: "machine-id" },
    };

    await expect(resolveCursorModels(credentials)).resolves.toEqual({
      models: [{ id: "claude-4.6-opus", name: "Claude 4.6 Opus" }],
    });
    await expect(resolveCursorModels(credentials)).resolves.toEqual({
      models: [{ id: "claude-4.6-opus", name: "Claude 4.6 Opus" }],
    });

    expect(http2.connect).toHaveBeenCalledExactlyOnceWith("https://agent.api5.cursor.sh");
    expect(client.request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      ":method": "POST",
      ":path": "/agent.v1.AgentService/GetUsableModels",
      ":authority": "agent.api5.cursor.sh",
      "content-type": "application/proto",
      accept: "application/proto",
      authorization: "Bearer cursor-token",
    }));
    expect(request.end).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(client.close).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails open when the Cursor catalog request fails", async () => {
    responseStatus = 403;

    await expect(resolveCursorModels({
      accessToken: "cursor-token",
      providerSpecificData: { machineId: "machine-id" },
    })).resolves.toBeNull();
    expect(http2.connect).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails open and closes the session on an HTTP/2 transport error", async () => {
    request.end.mockImplementation(() => queueMicrotask(() => request.emit("error", new Error("h2 failed"))));
    await expect(resolveCursorModels({
      accessToken: "cursor-token", providerSpecificData: { machineId: "machine-id" },
    })).resolves.toBeNull();
    expect(client.close).toHaveBeenCalledOnce();
  });
});
