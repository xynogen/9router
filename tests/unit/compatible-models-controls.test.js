import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "vitest";

const section = readFileSync(new URL("../../src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../src/app/(dashboard)/dashboard/providers/[id]/page.js", import.meta.url), "utf8");

test("filter stays accessible when the list shrinks", () => {
  assert.ok(section.includes("(allModels.length > 5 || filter) && ("));
});

test("bulk enable reports partial failures and refreshes model states", async () => {
  const code = page.split("  const handleSetModelsDisabled = ")[1]?.split("  const handleEnableModel = ")[0]?.trim().replace(/;$/, "");
  assert.ok(code);
  const responses = [{ ok: true }, { ok: false }];
  const requests = [];
  const messages = [];
  let refreshes = 0;
  const handler = new Function("fetch", "alert", "fetchDisabledModels", "providerStorageAlias", `return ${code}`)(
    async (url) => { requests.push(url); return responses.shift(); },
    (message) => messages.push(message),
    async () => { refreshes++; },
    "ollama",
  );

  await handler(["model-a", "model-b"], false);
  assert.equal(requests.length, 2);
  assert.equal(messages.length, 1);
  assert.equal(refreshes, 1);
});
