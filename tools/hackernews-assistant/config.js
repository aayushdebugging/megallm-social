// ─────────────────────────────────────────────────────────────
// Hacker News assistant — ESM (fetch stories + draft comments via MegaLLM)
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  apiKey: process.env.MEGALLM_API_KEY || "",
  apiBaseUrl: process.env.MEGALLM_BASE_URL || "https://ai.megallm.io/v1",
  model: process.env.MODEL || "claude-sonnet-4-5-20250929",

  product: {
    name: "MegaLLM",
    description: "Unified LLM API gateway — one API for 70+ AI models",
    url: "https://megallm.io",
    mentionRate: 0.1,
  },

  /** Official HN Firebase API — no key required */
  hn: {
    list: process.env.HN_LIST || "top",
    idFetchLimit: parseInt(process.env.HN_ID_FETCH_LIMIT || "80", 10),
    minScore: parseInt(process.env.HN_MIN_SCORE || "8", 10),
    maxComments: parseInt(process.env.HN_MAX_COMMENTS || "500", 10),
    maxStories: parseInt(process.env.HN_MAX_STORIES || "30", 10),
    topLevelCommentSample: 6,
    requestDelayMs: 90,
  },

  comments: {
    maxPerDay: 8,
    minWords: 12,
    maxWords: 85,
    forceLowercase: true,
    tone: "curious hn reader — concise, technical, slightly skeptical",
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

  port: parseInt(process.env.HN_ASSISTANT_PORT || process.env.PORT || "3458", 10),
};

export function validateLlm() {
  if (!CONFIG.apiKey) {
    throw new Error("MEGALLM_API_KEY not configured for drafting");
  }
}
