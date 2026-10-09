import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// ponytail: Node >=22.15 resolves the Next.js alias natively; no test-only loader file.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith("@/")
      ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier, context);
  },
});

const {
  formatX509Certificate,
  isSamlConfigured,
  generateSamlMetadata,
  pickSamlEmail,
  pickSamlDisplayName,
} = await import("../../src/lib/auth/saml.js");
hooks.deregister();

test("formatX509Certificate normalizes Base64 strings into PEM blocks", () => {
  const rawBase64 = "MIIC1234567890123456789012345678901234567890123456789012345678901234567890";
  const formatted = formatX509Certificate(rawBase64);
  assert.match(formatted, /-----BEGIN CERTIFICATE-----/);
  assert.match(formatted, /-----END CERTIFICATE-----/);
  assert.equal(formatX509Certificate(""), "");
});

test("isSamlConfigured checks required fields", () => {
  assert.equal(isSamlConfigured({ samlEntryPoint: "https://idp.com/sso", samlCert: "cert" }), true);
  assert.equal(isSamlConfigured({ samlEntryPoint: "https://idp.com/sso" }), false);
  assert.equal(isSamlConfigured({}), false);
});

test("generateSamlMetadata produces valid SP XML", () => {
  const settings = {
    samlEntryPoint: "https://idp.example.com/sso",
    samlIssuer: "urn:9router:sp",
    samlCert: "MIIC123456789012345678901234567890123456789012345678901234567890",
  };
  const xml = generateSamlMetadata("https://localhost:20127", settings);
  assert.match(xml, /entityID="urn:9router:sp"/);
  assert.match(xml, /Location="https:\/\/localhost:20127\/api\/auth\/saml\/acs"/);
});

test("Claims Extraction pickSamlEmail & pickSamlDisplayName", () => {
  const profile = { email: "test@example.com", name: "Test User" };
  assert.equal(pickSamlEmail(profile, {}), "test@example.com");
  assert.equal(pickSamlDisplayName(profile, {}), "Test User");
});
