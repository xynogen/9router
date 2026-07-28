// Helpers for OpenAI Responses API streaming termination + event framing
import { FORMATS } from "../translator/formats.js";
import { formatSSE, buildTerminalChunks } from "./streamHelpers.js";

// Responses API events that signal the stream has reached a terminal state
const OPENAI_RESPONSES_TERMINAL_EVENTS = new Set([
	"response.completed",
	"response.done",
	"response.failed",
	"error",
]);

export function getOpenAIResponsesEventName(eventName, chunk) {
	if (eventName) return eventName;
	if (chunk && typeof chunk.type === "string") return chunk.type;
	return null;
}

export function isOpenAIResponsesTerminalEvent(eventName, chunk) {
	const type = getOpenAIResponsesEventName(eventName, chunk);
	if (OPENAI_RESPONSES_TERMINAL_EVENTS.has(type)) return true;
	const status = chunk?.response?.status;
	return status === "completed" || status === "failed";
}

const sharedEncoder = new TextEncoder();

// Encoded response.failed + [DONE] payload for aborted/stalled Responses passthrough streams
export function buildAbortedResponsesTerminalBytes() {
	return sharedEncoder.encode(
		`${formatIncompleteOpenAIResponsesStreamFailure()}data: [DONE]\n\n`,
	);
}

// Terminal bytes for a stream killed mid-flight (client abort, stall timeout,
// socket reset). Closing without a finish_reason makes strict clients throw
// "Stream ended without finish_reason" and drop the partial answer; "length"
// reports the truncation honestly instead of faking a clean stop.
export function buildAbortedTerminalBytes(sourceFormat, model) {
	if (sourceFormat === FORMATS.OPENAI_RESPONSES)
		return buildAbortedResponsesTerminalBytes();

	const chunks = buildTerminalChunks(sourceFormat, model, "length");
	if (chunks.length === 0) return null;

	const body = chunks.map((chunk) => formatSSE(chunk, sourceFormat)).join("");
	return sharedEncoder.encode(`${body}data: [DONE]\n\n`);
}

// Synthesize a response.failed event for streams that close without a terminal event
export function formatIncompleteOpenAIResponsesStreamFailure() {
	return formatSSE(
		{
			event: "response.failed",
			data: {
				type: "response.failed",
				response: {
					id: `resp_${Date.now()}`,
					status: "failed",
					error: {
						type: "stream_error",
						code: "stream_disconnected",
						message: "stream closed before response.completed",
					},
				},
			},
		},
		FORMATS.OPENAI_RESPONSES,
	);
}
