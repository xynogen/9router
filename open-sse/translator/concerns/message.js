import { OPENAI_BLOCK } from "../schema/index.js";

// Text-only arrays can use the string form; preserve multimodal blocks and metadata.
export function collapseTextParts(parts) {
  return parts.length > 0 && parts.every(p => p.type === OPENAI_BLOCK.TEXT && Object.keys(p).every(k => k === "type" || k === "text"))
    ? parts.map(p => p.text).join("\n") : parts;
}
