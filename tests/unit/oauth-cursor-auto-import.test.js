import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import * as fsPromises from "fs/promises";
import { execFile } from "child_process";

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ status: init?.status || 200, body }) },
}));
vi.mock("os", () => ({ homedir: () => "/mock/home" }));
vi.mock("fs/promises", () => ({ access: vi.fn(), constants: { R_OK: 4 } }));
vi.mock("child_process", () => ({ execFile: vi.fn() }));

// The route uses CommonJS require: vi.mock cannot intercept it. Replace only
// this worker's cached module export and restore it after each test.
const require = createRequire(import.meta.url);
const sqlitePath = require.resolve("better-sqlite3");
const originalDatabase = require("better-sqlite3");
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const macPath = "/mock/home/Library/Application Support/Cursor/User/globalStorage/state.vscdb";
const mockDb = { prepare: vi.fn(), close: vi.fn() };
let rows;
let failOpen;
let openDatabase;
let GET;

beforeEach(async () => {
  vi.resetAllMocks();
  rows = {};
  failOpen = false;
  openDatabase = vi.fn();
  Object.defineProperty(process, "platform", { ...originalPlatform, value: "darwin" });
  vi.mocked(fsPromises.access).mockResolvedValue(undefined);
  vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => callback(new Error("CLI unavailable")));
  mockDb.prepare.mockReturnValue({ get: vi.fn((key) => rows[key] ? { value: rows[key] } : undefined) });
  require.cache[sqlitePath].exports = class MockDatabase {
    constructor(path, options) {
      openDatabase(path, options);
      if (failOpen) throw new Error("SQLITE_CANTOPEN");
      return mockDb;
    }
  };
  ({ GET } = await import("../../src/app/api/oauth/cursor/auto-import/route.js"));
});

afterEach(() => {
  require.cache[sqlitePath].exports = originalDatabase;
  Object.defineProperty(process, "platform", originalPlatform);
  vi.unstubAllEnvs();
});

describe("GET /api/oauth/cursor/auto-import", () => {
  it("reports every macOS candidate when none is readable", async () => {
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      found: false,
      error: `Cursor database not found. Checked locations:\n${macPath}\n/mock/home/Library/Application Support/Cursor - Insiders/User/globalStorage/state.vscdb\n\nMake sure Cursor IDE is installed and opened at least once.`,
    });
    expect(fsPromises.access).toHaveBeenCalledTimes(2);
    expect(openDatabase).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
  });

  it("probes Insiders when the standard macOS database is missing", async () => {
    vi.mocked(fsPromises.access).mockRejectedValueOnce(new Error("ENOENT"));
    rows = { "cursorAuth/accessToken": "test-token", "storage.serviceMachineId": "test-machine-id" };
    expect((await GET()).body.found).toBe(true);
    expect(openDatabase).toHaveBeenCalledExactlyOnceWith(
      "/mock/home/Library/Application Support/Cursor - Insiders/User/globalStorage/state.vscdb",
      { readonly: true, fileMustExist: true },
    );
  });

  it("extracts exact keys using read-only SQLite and closes the database", async () => {
    rows = { "cursorAuth/accessToken": "test-token", "storage.serviceMachineId": "test-machine-id" };
    expect((await GET()).body).toEqual({ found: true, accessToken: "test-token", machineId: "test-machine-id" });
    expect(openDatabase).toHaveBeenCalledExactlyOnceWith(macPath, { readonly: true, fileMustExist: true });
    expect(mockDb.prepare).toHaveBeenCalledWith("SELECT value FROM itemTable WHERE key=? LIMIT 1");
    expect(mockDb.close).toHaveBeenCalledOnce();
    expect(execFile).not.toHaveBeenCalled();
  });

  it("unwraps JSON-encoded string values", async () => {
    rows = { "cursorAuth/accessToken": '"json-token"', "storage.serviceMachineId": '"json-machine-id"' };
    expect((await GET()).body).toEqual({ found: true, accessToken: "json-token", machineId: "json-machine-id" });
  });

  it("uses known alternate keys rather than fuzzy matching", async () => {
    rows = { "cursorAuth/token": "alternate-token", "telemetry.machineId": "alternate-machine" };
    expect((await GET()).body).toEqual({ found: true, accessToken: "alternate-token", machineId: "alternate-machine" });
  });

  it("prefers primary keys when alternate keys also exist", async () => {
    rows = {
      "cursorAuth/accessToken": "primary-token", "cursorAuth/token": "alternate-token",
      "storage.serviceMachineId": "primary-machine", "telemetry.machineId": "alternate-machine",
    };
    expect((await GET()).body).toEqual({ found: true, accessToken: "primary-token", machineId: "primary-machine" });
  });

  it("falls back to the sqlite3 CLI when native bindings cannot open the database", async () => {
    failOpen = true;
    vi.mocked(execFile).mockImplementation((_file, args, _options, callback) => {
      const value = args[1].includes("cursorAuth/accessToken") ? '"cli-token"\n' : '"cli-machine"\n';
      callback(null, { stdout: value });
    });
    expect((await GET()).body).toEqual({ found: true, accessToken: "cli-token", machineId: "cli-machine" });
    expect(execFile).toHaveBeenCalledWith("sqlite3", [macPath, "SELECT value FROM itemTable WHERE key='cursorAuth/accessToken' LIMIT 1"], { timeout: 10000 }, expect.any(Function));
    expect(execFile).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("offers manual import when both strategies fail (native open failure: %s)", async (nativeFailure) => {
    failOpen = nativeFailure;
    expect((await GET()).body).toEqual({ found: false, windowsManual: true, dbPath: macPath });
    expect(execFile).toHaveBeenCalledTimes(5);
    if (!nativeFailure) expect(mockDb.close).toHaveBeenCalledOnce();
  });

  it("probes both Linux config paths before reporting not found", async () => {
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "linux" });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));
    const response = await GET();
    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("/mock/home/.config/Cursor/User/globalStorage/state.vscdb\n/mock/home/.config/cursor/User/globalStorage/state.vscdb");
    expect(fsPromises.access).toHaveBeenCalledTimes(2);
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("does not import leftover Linux config without an installed IDE", async () => {
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "linux" });
    vi.mocked(fsPromises.access).mockResolvedValueOnce(undefined).mockRejectedValue(new Error("ENOENT"));
    expect((await GET()).body).toEqual({ found: false, error: "Cursor config files found but Cursor IDE does not appear to be installed. Skipping auto-import." });
    expect(execFile).toHaveBeenCalledExactlyOnceWith("which", ["cursor"], { timeout: 5000 }, expect.any(Function));
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("imports on Linux when the cursor binary is installed", async () => {
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "linux" });
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => callback(null, { stdout: "/usr/bin/cursor" }));
    rows = { "cursorAuth/accessToken": "linux-token", "storage.machineId": "linux-machine" };
    expect((await GET()).body).toEqual({ found: true, accessToken: "linux-token", machineId: "linux-machine" });
  });

  it("uses APPDATA for Windows database probing", async () => {
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "win32" });
    vi.stubEnv("APPDATA", "/mock/roaming");
    rows = { "cursorAuth/accessToken": "windows-token", "storage.machineId": "windows-machine" };
    expect((await GET()).body.found).toBe(true);
    expect(openDatabase).toHaveBeenCalledExactlyOnceWith("/mock/roaming/Cursor/User/globalStorage/state.vscdb", { readonly: true, fileMustExist: true });
  });

  it("uses the default config paths on other platforms", async () => {
    Object.defineProperty(process, "platform", { ...originalPlatform, value: "freebsd" });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));
    expect((await GET()).body.found).toBe(false);
    expect(fsPromises.access).toHaveBeenCalledWith("/mock/home/.config/Cursor/User/globalStorage/state.vscdb", 4);
    expect(openDatabase).not.toHaveBeenCalled();
  });
});
