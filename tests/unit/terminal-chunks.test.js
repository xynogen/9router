// Regression for "Stream ended without finish_reason": buildTerminalChunks must
// synthesize a terminal marker for strict clients (pi-ai) when a provider stream
// ends without one, and stay silent for formats that own their terminal path.
import { describe, it, expect } from "vitest";
import { buildTerminalChunks } from "../../open-sse/utils/streamHelpers.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

describe("buildTerminalChunks", () => {
	it("emits an OpenAI finish_reason chunk on clean EOF", () => {
		const [chunk, ...rest] = buildTerminalChunks(FORMATS.OPENAI, "gpt-x");
		expect(rest).toHaveLength(0);
		expect(chunk.choices[0].finish_reason).toBe("stop");
		expect(chunk.object).toBe("chat.completion.chunk");
		expect(chunk.model).toBe("gpt-x");
	});

	it("maps abort/stall to length (honest truncation)", () => {
		const [chunk] = buildTerminalChunks(FORMATS.OPENAI, "gpt-x", "length");
		expect(chunk.choices[0].finish_reason).toBe("length");
	});

	it("emits message_delta + message_stop for Claude", () => {
		const chunks = buildTerminalChunks(FORMATS.CLAUDE, "claude-x");
		expect(chunks.map((c) => c.type)).toEqual([
			"message_delta",
			"message_stop",
		]);
		expect(chunks[0].delta.stop_reason).toBe("end_turn");
		const truncated = buildTerminalChunks(FORMATS.CLAUDE, "claude-x", "length");
		expect(truncated[0].delta.stop_reason).toBe("max_tokens");
	});

	it("stays silent for formats with their own terminal path or bare-EOF tolerance", () => {
		for (const fmt of [
			FORMATS.OPENAI_RESPONSES,
			FORMATS.GEMINI,
			FORMATS.GEMINI_CLI,
			FORMATS.ANTIGRAVITY,
			FORMATS.VERTEX,
			FORMATS.OLLAMA,
		]) {
			expect(buildTerminalChunks(fmt, "m")).toEqual([]);
		}
	});
});
