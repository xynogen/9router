/**
 * Tests for non-streaming Responses API translation.
 * Covers translateNonStreamingResponse() with openai-responses sourceFormat
 * and the openAICompletionToResponsesApi() converter.
 */
import { describe, it, expect } from "vitest";
import { translateNonStreamingResponse } from "../../open-sse/handlers/chatCore/nonStreamingHandler.js";

// Format constants (avoid import chain that pulls in @/lib/usageDb)
const OPENAI = "openai";
const OPENAI_RESPONSES = "openai-responses";
const CLAUDE = "claude";
const GEMINI = "gemini";
const OLLAMA = "ollama";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOpenAIResponse(overrides = {}) {
	return {
		id: "chatcmpl-abc123",
		object: "chat.completion",
		created: 1700000000,
		model: "test-model",
		choices: [
			{
				index: 0,
				message: { role: "assistant", content: "Hello!" },
				finish_reason: "stop",
			},
		],
		usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		...overrides,
	};
}

function makeClaudeResponse(overrides = {}) {
	return {
		id: "msg_abc123",
		type: "message",
		role: "assistant",
		model: "claude-3",
		content: [{ type: "text", text: "Hello from Claude!" }],
		stop_reason: "end_turn",
		usage: { input_tokens: 10, output_tokens: 5 },
		...overrides,
	};
}

// ─── Two-step pipeline scenarios ────────────────────────────────────────────

describe("translateNonStreamingResponse — pipeline", () => {
	it("short-circuits when targetFormat === sourceFormat", () => {
		const body = makeOpenAIResponse();
		const result = translateNonStreamingResponse(body, OPENAI, OPENAI);
		expect(result).toBe(body); // exact same reference
	});

	it("openai → openai-responses: converts to Responses API", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.object).toBe("response");
		expect(result.output).toBeDefined();
		expect(result.output[0].type).toBe("message");
		expect(result.choices).toBeUndefined();
	});

	it("openai → claude: converts to Claude message (no regression)", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			CLAUDE,
		);
		expect(result.type).toBe("message");
		expect(result.role).toBe("assistant");
		expect(result.content[0].type).toBe("text");
		expect(result.content[0].text).toBe("Hello!");
	});

	it("claude → openai-responses: two-step (claude→openai→responses)", () => {
		const result = translateNonStreamingResponse(
			makeClaudeResponse(),
			CLAUDE,
			OPENAI_RESPONSES,
		);
		expect(result.object).toBe("response");
		expect(result.output).toBeDefined();
		expect(result.output[0].type).toBe("message");
		expect(result.output[0].content[0].text).toBe("Hello from Claude!");
	});

	it("claude → openai: translates to OpenAI format (no regression)", () => {
		const result = translateNonStreamingResponse(
			makeClaudeResponse(),
			CLAUDE,
			OPENAI,
		);
		expect(result.choices).toBeDefined();
		expect(result.choices[0].message.content).toBe("Hello from Claude!");
		expect(result.object).toBe("chat.completion");
	});

	it("gemini → openai: translates correctly (no regression)", () => {
		const geminiBody = {
			candidates: [
				{
					content: { parts: [{ text: "Hello from Gemini!" }] },
					finishReason: "STOP",
				},
			],
			usageMetadata: {
				promptTokenCount: 10,
				candidatesTokenCount: 5,
				totalTokenCount: 15,
			},
		};
		const result = translateNonStreamingResponse(geminiBody, GEMINI, OPENAI);
		expect(result.choices).toBeDefined();
		expect(result.choices[0].message.content).toBe("Hello from Gemini!");
	});

	it("gemini → openai-responses: two-step (gemini→openai→responses)", () => {
		const geminiBody = {
			candidates: [
				{
					content: { parts: [{ text: "Hello from Gemini!" }] },
					finishReason: "STOP",
				},
			],
			usageMetadata: {
				promptTokenCount: 10,
				candidatesTokenCount: 5,
				totalTokenCount: 15,
			},
		};
		const result = translateNonStreamingResponse(
			geminiBody,
			GEMINI,
			OPENAI_RESPONSES,
		);
		expect(result.object).toBe("response");
		expect(result.output[0].type).toBe("message");
		expect(result.output[0].content[0].text).toBe("Hello from Gemini!");
		expect(result.usage.input_tokens).toBe(10);
		expect(result.usage.output_tokens).toBe(5);
	});
});

// ─── openAICompletionToResponsesApi — shape validation ──────────────────────

describe("openAI → Responses API conversion", () => {
	it("produces correct top-level shape", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.id).toMatch(/^resp_/);
		expect(result.object).toBe("response");
		expect(result.created_at).toBe(1700000000);
		expect(result.model).toBe("test-model");
		expect(result.status).toBe("completed");
		expect(result.error).toBeNull();
		expect(result.output).toBeInstanceOf(Array);
		expect(result.usage).toBeDefined();
	});

	it("maps usage fields correctly", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse({
				usage: { prompt_tokens: 42, completion_tokens: 13, total_tokens: 55 },
			}),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.usage.input_tokens).toBe(42);
		expect(result.usage.output_tokens).toBe(13);
		expect(result.usage.total_tokens).toBe(55);
	});

	it("calculates total_tokens when missing", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse({
				usage: { prompt_tokens: 10, completion_tokens: 5 },
			}),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.usage.total_tokens).toBe(15);
	});

	it("handles empty usage", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse({ usage: {} }),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.usage.input_tokens).toBe(0);
		expect(result.usage.output_tokens).toBe(0);
		expect(result.usage.total_tokens).toBe(0);
	});

	it("produces message output item with content array", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			OPENAI_RESPONSES,
		);
		const msg = result.output[0];
		expect(msg.type).toBe("message");
		expect(msg.role).toBe("assistant");
		expect(msg.status).toBe("completed");
		expect(msg.id).toMatch(/^msg_/);
		expect(msg.content).toBeInstanceOf(Array);
		expect(msg.content[0].type).toBe("output_text");
		expect(msg.content[0].text).toBe("Hello!");
		expect(msg.content[0].annotations).toEqual([]);
	});

	it("converts tool_calls to function_call items", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_001",
								type: "function",
								function: { name: "get_weather", arguments: '{"city":"NYC"}' },
							},
							{
								id: "call_002",
								type: "function",
								function: { name: "get_time", arguments: '{"tz":"UTC"}' },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output).toHaveLength(2);

		const fc1 = result.output[0];
		expect(fc1.type).toBe("function_call");
		expect(fc1.call_id).toBe("call_001");
		expect(fc1.name).toBe("get_weather");
		expect(fc1.arguments).toBe('{"city":"NYC"}');
		expect(fc1.status).toBe("completed");
		expect(fc1.id).toBe("fc_call_001");

		const fc2 = result.output[1];
		expect(fc2.call_id).toBe("call_002");
		expect(fc2.name).toBe("get_time");
	});

	it("handles text + tool_calls in same message", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: "Let me check that for you.",
						tool_calls: [
							{
								id: "call_x",
								type: "function",
								function: { name: "search", arguments: '{"q":"test"}' },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output).toHaveLength(2);
		expect(result.output[0].type).toBe("message");
		expect(result.output[0].content[0].text).toBe("Let me check that for you.");
		expect(result.output[1].type).toBe("function_call");
		expect(result.output[1].name).toBe("search");
	});

	it("handles empty content with fallback message", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: { role: "assistant", content: "" },
					finish_reason: "stop",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output).toHaveLength(1);
		expect(result.output[0].type).toBe("message");
		expect(result.output[0].content[0].text).toBe("");
	});

	it("handles null content with fallback message", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: { role: "assistant", content: null },
					finish_reason: "stop",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output).toHaveLength(1);
		expect(result.output[0].type).toBe("message");
		expect(result.output[0].content[0].text).toBe("");
	});

	it("handles missing choices gracefully", () => {
		const body = {
			id: "chatcmpl-empty",
			created: 1700000000,
			model: "m",
			choices: [],
			usage: {},
		};
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		// Should still produce a response with empty output
		expect(result.object).toBe("response");
		expect(result.output).toHaveLength(1);
		expect(result.output[0].type).toBe("message");
	});

	it("handles response with no choices array at all", () => {
		const body = {
			id: "chatcmpl-nope",
			created: 1700000000,
			model: "m",
			usage: {},
		};
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.object).toBe("response");
		expect(result.output).toHaveLength(1);
	});
});

// ─── arguments type safety (I3) ─────────────────────────────────────────────

describe("arguments type safety", () => {
	it("string arguments are passed through", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "c1",
								type: "function",
								function: { name: "f", arguments: '{"x":1}' },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(typeof result.output[0].arguments).toBe("string");
		expect(result.output[0].arguments).toBe('{"x":1}');
	});

	it("object arguments are JSON-stringified", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "c1",
								type: "function",
								function: { name: "f", arguments: { x: 1 } },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(typeof result.output[0].arguments).toBe("string");
		expect(JSON.parse(result.output[0].arguments)).toEqual({ x: 1 });
	});

	it("null/undefined arguments default to '{}'", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{ id: "c1", type: "function", function: { name: "f" } },
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output[0].arguments).toBe("{}");
	});
});

// ─── ID uniqueness (I5) ─────────────────────────────────────────────────────

describe("ID uniqueness for tool calls", () => {
	it("tool calls with IDs preserve them", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_aaa",
								type: "function",
								function: { name: "f1", arguments: "{}" },
							},
							{
								id: "call_bbb",
								type: "function",
								function: { name: "f2", arguments: "{}" },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.output[0].call_id).toBe("call_aaa");
		expect(result.output[1].call_id).toBe("call_bbb");
	});

	it("tool calls without IDs get unique fallback IDs", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{ type: "function", function: { name: "f1", arguments: "{}" } },
							{ type: "function", function: { name: "f2", arguments: "{}" } },
							{ type: "function", function: { name: "f3", arguments: "{}" } },
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		const ids = result.output.map((o) => o.call_id);
		// All IDs must be unique
		expect(new Set(ids).size).toBe(ids.length);
		// IDs should have index discriminator
		expect(ids[0]).toContain("_0");
		expect(ids[1]).toContain("_1");
		expect(ids[2]).toContain("_2");
	});
});

// ─── model field (C1) ───────────────────────────────────────────────────────

describe("model field in Responses API output", () => {
	it("includes model from provider response", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse({ model: "deepseek-v4-flash" }),
			OPENAI,
			OPENAI_RESPONSES,
		);
		expect(result.model).toBe("deepseek-v4-flash");
	});

	it("omits model when provider response has none", () => {
		const body = makeOpenAIResponse();
		delete body.model;
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		// model should be undefined, not "undefined" string
		expect(result.model).toBeUndefined();
	});
});

// ─── DBeaver compatibility ──────────────────────────────────────────────────

describe("DBeaver compatibility", () => {
	it("response has all fields DBeaver OAIResponsesResponse expects", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse({ model: "gpt-4o" }),
			OPENAI,
			OPENAI_RESPONSES,
		);

		// Top-level fields DBeaver reads
		expect(result).toHaveProperty("id");
		expect(result).toHaveProperty("object", "response");
		expect(result).toHaveProperty("model", "gpt-4o");
		expect(result).toHaveProperty("status", "completed");
		expect(result).toHaveProperty("output");
		expect(result).toHaveProperty("usage");
		expect(result.usage).toHaveProperty("input_tokens");
		expect(result.usage).toHaveProperty("output_tokens");

		// Output item fields DBeaver OAIMessage reads
		const msg = result.output[0];
		expect(msg).toHaveProperty("type", "message");
		expect(msg).toHaveProperty("id");
		expect(msg).toHaveProperty("status", "completed");
		expect(msg).toHaveProperty("role", "assistant");
		expect(msg).toHaveProperty("content");

		// Content fields DBeaver OAIMessageContent reads
		const content = msg.content[0];
		expect(content).toHaveProperty("type", "output_text");
		expect(content).toHaveProperty("text");
	});

	it("function_call has all fields DBeaver OAIMessage expects", () => {
		const body = makeOpenAIResponse({
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_1",
								type: "function",
								function: { name: "query_db", arguments: '{"sql":"SELECT 1"}' },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
		});
		const result = translateNonStreamingResponse(
			body,
			OPENAI,
			OPENAI_RESPONSES,
		);
		const fc = result.output[0];

		// Fields DBeaver OAIMessage reads for function_call
		expect(fc).toHaveProperty("type", "function_call");
		expect(fc).toHaveProperty("id");
		expect(fc).toHaveProperty("status", "completed");
		expect(fc).toHaveProperty("call_id", "call_1");
		expect(fc).toHaveProperty("name", "query_db");
		expect(fc).toHaveProperty("arguments", '{"sql":"SELECT 1"}');
	});

	it("non-streaming response is valid JSON (not SSE)", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			OPENAI_RESPONSES,
		);
		// Should be serializable as JSON
		const json = JSON.stringify(result);
		const parsed = JSON.parse(json);
		expect(parsed.object).toBe("response");
		// Must not have SSE artifacts
		expect(json).not.toContain("event:");
		expect(json).not.toContain("data:");
	});
});

// ─── Regression: existing paths must not break ──────────────────────────────

describe("regression — existing translation paths", () => {
	it("openai → openai passes through unchanged", () => {
		const body = makeOpenAIResponse();
		const result = translateNonStreamingResponse(body, OPENAI, OPENAI);
		expect(result).toBe(body);
	});

	it("claude → openai still works", () => {
		const result = translateNonStreamingResponse(
			makeClaudeResponse(),
			CLAUDE,
			OPENAI,
		);
		expect(result.choices).toBeDefined();
		expect(result.choices[0].message.content).toBe("Hello from Claude!");
	});

	it("claude → claude passes through unchanged", () => {
		const body = makeClaudeResponse();
		const result = translateNonStreamingResponse(body, CLAUDE, CLAUDE);
		expect(result).toBe(body);
	});

	it("openai → claude still works", () => {
		const result = translateNonStreamingResponse(
			makeOpenAIResponse(),
			OPENAI,
			CLAUDE,
		);
		expect(result.type).toBe("message");
		expect(result.content[0].type).toBe("text");
	});

	it("claude provider returning OpenAI format (xiaomi-tokenplan quirk) passthrough", () => {
		// Some providers set targetFormat=claude but return OpenAI-shaped JSON
		const openaiStyleBody = makeOpenAIResponse();
		const result = translateNonStreamingResponse(
			openaiStyleBody,
			CLAUDE,
			OPENAI,
		);
		// translateToOpenAI for claude sees choices[] → returns as-is
		expect(result.choices).toBeDefined();
	});

	it("gemini → openai still works", () => {
		const geminiBody = {
			candidates: [
				{
					content: { parts: [{ text: "Hello!" }] },
					finishReason: "STOP",
				},
			],
			usageMetadata: {
				promptTokenCount: 5,
				candidatesTokenCount: 3,
				totalTokenCount: 8,
			},
		};
		const result = translateNonStreamingResponse(geminiBody, GEMINI, OPENAI);
		expect(result.choices[0].message.content).toBe("Hello!");
		expect(result.usage.prompt_tokens).toBe(5);
	});

	it("gemini with tool calls → openai", () => {
		const geminiBody = {
			candidates: [
				{
					content: {
						parts: [{ functionCall: { name: "search", args: { q: "test" } } }],
					},
					finishReason: "STOP",
				},
			],
		};
		const result = translateNonStreamingResponse(geminiBody, GEMINI, OPENAI);
		expect(result.choices[0].message.tool_calls).toBeDefined();
		expect(result.choices[0].message.tool_calls[0].function.name).toBe(
			"search",
		);
		expect(result.choices[0].finish_reason).toBe("tool_calls");
	});
});
