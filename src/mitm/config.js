// All intercepted domains + URL patterns per tool

const IS_DEV = process.env.NODE_ENV === "development";

const TARGET_HOSTS = [
  "daily-cloudcode-pa.googleapis.com",
  "cloudcode-pa.googleapis.com",
  "api.individual.githubcopilot.com",
  "q.us-east-1.amazonaws.com",
  "api2.cursor.sh",
];

const URL_PATTERNS = {
  antigravity: [":generateContent", ":streamGenerateContent"],
  copilot: ["/chat/completions", "/v1/messages", "/responses"],
  kiro: ["/generateAssistantResponse"],
  cursor: ["/BidiAppend", "/RunSSE", "/RunPoll", "/Run"],
};

// Synonym map: rawModel from request → canonical alias key in mitmAlias DB
const MODEL_SYNONYMS = {
  antigravity: { "gemini-default": "gemini-3-flash" },
};

// Pattern fallback: rawModel regex → canonical alias key (when exact + prefix match fail)
// Order matters: more specific patterns first. Catches AG renamed variants (e.g. gemini-pro-agent)
const MODEL_PATTERNS = {
  antigravity: [
    { match: /flash/i,                   alias: "gemini-3-flash" },
    { match: /pro.*low|low.*pro/i,       alias: "gemini-3.1-pro-low" },
    { match: /gemini.*pro|pro.*gemini/i, alias: "gemini-3.1-pro-high" },
    { match: /opus/i,                    alias: "claude-opus-4-6-thinking" },
    { match: /sonnet|claude/i,           alias: "claude-sonnet-4-6" },
    { match: /gpt.*oss|oss/i,            alias: "gpt-oss-120b-medium" },
  ],
};

// URL substrings whose request/response should NOT be dumped to file (telemetry, polling, empty)
const LOG_BLACKLIST_URL_PARTS = [
  "recordCodeAssistMetrics",
  "recordTrajectoryAnalytics",
  "fetchAdminControls",
  "listExperiments",
  "fetchUserInfo",
];

function getToolForHost(host) {
  const h = (host || "").split(":")[0];
  if (h === "api.individual.githubcopilot.com") return "copilot";
  if (h === "daily-cloudcode-pa.googleapis.com" || h === "cloudcode-pa.googleapis.com") return "antigravity";
  if (h === "q.us-east-1.amazonaws.com") return "kiro";
  if (h === "api2.cursor.sh") return "cursor";
  return null;
}

module.exports = { IS_DEV, TARGET_HOSTS, URL_PATTERNS, MODEL_SYNONYMS, MODEL_PATTERNS, LOG_BLACKLIST_URL_PARTS, getToolForHost };
