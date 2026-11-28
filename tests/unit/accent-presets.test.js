import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = new URL("../../src/", import.meta.url);
const menu = readFileSync(new URL("shared/components/HeaderMenu.js", root), "utf8");
const css = readFileSync(new URL("app/globals.css", root), "utf8");
const store = readFileSync(new URL("store/themeStore.js", root), "utf8");
const layout = readFileSync(new URL("app/layout.js", root), "utf8");

test("all ten menu presets have CSS colors and persist across reloads", () => {
  const ids = [...menu.matchAll(/\["(\w+)", "\w+", "#[0-9a-f]{6}"\]/g)].map((match) => match[1]);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  for (const id of ids) {
    if (id !== "coral") assert.ok(css.includes(`:root[data-accent="${id}"]`), id);
    assert.ok(store.includes(`"${id}"`), id);
    assert.ok(layout.includes(`'${id}'`), id);
  }
  assert.match(store, /set\(\{ accent \}\)/);
  assert.match(store, /applyAccent\(get\(\)\.accent\)/);
});
