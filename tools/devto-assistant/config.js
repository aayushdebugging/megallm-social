// ─────────────────────────────────────────────────────────────
// Dev.to Assistant — ESM config (dashboard, fetch, draft, queue)
// package.json has "type": "module" — do not use require/module.exports
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  // LLM — MegaLLM only (drafting + simulations)
  apiKey: process.env.MEGALLM_API_KEY || "",
  apiBaseUrl: process.env.MEGALLM_BASE_URL || "https://ai.megallm.io/v1",
  model: process.env.MODEL || "claude-sonnet-4-5-20250929",

  product: {
    name: "MegaLLM",
    description: "Unified LLM API gateway — one API for 70+ AI models",
    url: "https://megallm.io",
    mentionRate: 0.1,
  },

  // Dev.to API — posting / schedule (post.js, schedule.js)
  devtoApiKey: process.env.DEVTO_API_KEY || "",
  devtoUsername: process.env.DEVTO_USERNAME || "",
  devtoApiUrl: process.env.DEVTO_API_URL || "https://dev.to/api",
  publishImmediately:
    (process.env.DEVTO_PUBLISH_IMMEDIATELY ?? "true").toLowerCase() === "true",
  defaultTags: (process.env.DEVTO_DEFAULT_TAGS || "ai,llm,api")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
  queueFile: "./data/queue.json",
  postIntervalMs: parseInt(process.env.DEVTO_POST_INTERVAL_MS || "60000", 10),
  verbose: (process.env.DEVTO_VERBOSE || "false").toLowerCase() === "true",

  tags: [
    "ai",
    "machinelearning",
    "webdev",
    "devops",
    "opensource",
    "javascript",
    "python",
    "programming",
    "beginners",
    "discuss",
  ],

  posts: {
    topDays: 7,
    minReactions: 3,
    maxComments: 200,
    articlesPerTag: 5,
  },

  comments: {
    maxPerDay: 8,
    minWords: 15,
    maxWords: 90,
    forceLowercase: true,
    tone: "helpful dev.to reader who writes tight comments",
    avoid: [
      "As an AI",
      "I'd be happy to",
      "Great question!",
      "Absolutely!",
      "It's worth noting",
      "In my experience as",
      "Here's the thing",
      "That being said",
      "Let me explain",
      "The key here is",
      "To be fair",
    ],
  },

  port: parseInt(process.env.DEVTO_ASSISTANT_PORT || process.env.PORT || "3457", 10),
};

export function validateDevtoPosting() {
  if (!CONFIG.devtoApiKey) throw new Error("DEVTO_API_KEY not configured");
  if (!CONFIG.devtoUsername) throw new Error("DEVTO_USERNAME not configured");
}

export function validateLlm() {
  if (!CONFIG.apiKey) {
    throw new Error("MEGALLM_API_KEY not configured for drafting");
  }
}
