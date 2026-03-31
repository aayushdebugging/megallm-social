// ─────────────────────────────────────────────────────────────
// X (Twitter) Assistant Configuration
// Uses X Scraper API (https://api.xscraper.io)
// ─────────────────────────────────────────────────────────────

import "./load-env.js"; // Load .env before reading environment variables
import { getAllSearchQueries, getFilters } from "./orchestration.js";

export const CONFIG = {
  // MegaLLM API (for drafting replies)
  apiKey: process.env.MEGALLM_API_KEY || "",
  apiBaseUrl: process.env.MEGALLM_BASE_URL || "https://ai.megallm.io/v1",
  model: process.env.MODEL || "claude-sonnet-4-6",

  product: {
    name: "MegaLLM",
    description: "Unified LLM API gateway — one API for 70+ AI models",
    url: "https://megallm.io",
    mentionRate: 0.1,
  },

  // X Scraper API
  xScraperApiKey: process.env.X_SCRAPER_API_KEY || "",
  xScraperApiUrl: process.env.X_SCRAPER_API_URL || "http://localhost:3005",
  // If using remote: https://api.xscraper.io

  // Tweet fetching - using smart orchestration
  tweets: {
    searchQueries: [
      "llm api gateway",
      "unified llm api",
      "llm routing",
      "groq api",
      "openrouter",
    ],
    maxResults: 4,                         // per query
    minLikes: 5,                           // Quality filter: minimum 5 likes
    minReplies: 0,                         // Get all tweets with engagement
  },

  // Reply drafting rules
  replies: {
    maxPerDay: 6,              // don't over-reply
    minWords: 10,               // short replies are okay on X
    maxWords: 280,              // X limit is 280 chars
    tone: "casual x reader — conversational, witty if appropriate",
    avoid: [
      "As an AI",
      "I'd be happy to",
      "Great question!",
      "Absolutely!",
      "It's worth noting",
      "Here's the thing",
      "That being said",
      "Let me explain",
      "The key here is",
      "To be fair",
      "As a developer",
    ],
  },

  // Server
  port: parseInt(process.env.X_ASSISTANT_PORT || process.env.PORT || "3459", 10),
};

export function validateXScraperApi() {
  // API key optional for local development
  if (!CONFIG.xScraperApiUrl) {
    throw new Error("X_SCRAPER_API_URL not configured");
  }
}

export function validateLlm() {
  if (!CONFIG.apiKey) {
    throw new Error("MEGALLM_API_KEY not configured for drafting");
  }
}
