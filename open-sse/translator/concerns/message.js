import { OPENAI_BLOCK } from "../schema/index.js";

// Client billing metadata must not become cached system instructions.
export function stripAnthropicBillingHeader(text) {
  if (typeof text !== "string") return "";
  return text.replace(/^x-anthropic-billing-header:[^\n]*(?:\r?\n)?/i, "");
}

// Text-only arrays can use string form; preserve multimodal blocks and metadata.
export function collapseTextParts(parts, { multiline = false } = {}) {
  return (multiline ? parts.length > 0 : parts.length === 1) && parts.every((p) => p.type === OPENAI_BLOCK.TEXT
    && Object.keys(p).every((key) => key === "type" || key === "text"))
    ? parts.map((p) => p.text).join("\n") : parts;
}
