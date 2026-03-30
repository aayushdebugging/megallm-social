// Bluesky assistant — public AppView API (no Bluesky login required for fetch)

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

  /** Public XRPC — https://docs.bsky.app/docs/advanced-guides/api-directory */
  bsky: {
    publicApi: (process.env.BSKY_PUBLIC_API || "https://public.api.bsky.app").replace(/\/$/, ""),
    /** Official Discover feed; override with BSKY_FEED_URI */
    feedUri:
      process.env.BSKY_FEED_URI ||
      "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
    feedPages: parseInt(process.env.BSKY_FEED_PAGES || "3", 10),
    pageLimit: Math.min(100, parseInt(process.env.BSKY_FEED_PAGE_LIMIT || "50", 10)),
    minLikes: parseInt(process.env.BSKY_MIN_LIKES || "15", 10),
    maxReplies: parseInt(process.env.BSKY_MAX_REPLIES || "400", 10),
    maxPosts: parseInt(process.env.BSKY_MAX_POSTS || "35", 10),
    threadDepth: parseInt(process.env.BSKY_THREAD_DEPTH || "2", 10),
    replySample: parseInt(process.env.BSKY_REPLY_SAMPLE || "6", 10),
    requestDelayMs: parseInt(process.env.BSKY_REQUEST_DELAY_MS || "120", 10),
  },

  comments: {
    maxPerDay: 8,
    minWords: 8,
    maxWords: 280,
    forceLowercase: true,
    tone: "casual bluesky — short lines, sincere or dry, not corporate",
    avoid: [
      "As an AI",
      "I'd be happy to",
      "Great question!",
      "Absolutely!",
      "It's worth noting",
      "Here's the thing",
      "That being said",
      "Let me explain",
      "To be fair",
    ],
  },
};

export function validateLlm() {
  if (!CONFIG.apiKey) {
    throw new Error("MEGALLM_API_KEY not configured for drafting");
  }
}
