import type { StrategyState } from "./types";

/**
 * Default strategy state with sensible initial weights.
 * This is used as the seed when no prior strategy exists in the state store.
 * The IMPROVE stage overwrites this with data-driven adjustments.
 */
export const DEFAULT_STRATEGY: StrategyState = {
  contentTypeWeights: {
    blog: 0.4,
    social: 0.35,
    comparison: 0.25,
  },
  platformWeights: {
    blog: 0.20,
    "x-twitter": 0.18,
    linkedin: 0.15,
    reddit: 0.15,
    devto: 0.10,
    hackernews: 0.02,
    hashnode: 0.10,
    medium: 0.08,
    telegraph: 0.02,
  },
  hotTopics: [
    "llm gateway",
    "ai model comparison",
    "llm cost optimization",
    "ai api pricing",
  ],
  coldTopics: [],
  keywordPriorities: [
    { cluster: "llm gateway", weight: 0.9 },
    { cluster: "openrouter alternative", weight: 0.85 },
    { cluster: "cheapest llm api", weight: 0.8 },
    { cluster: "llm api pricing", weight: 0.75 },
    { cluster: "unified llm api", weight: 0.7 },
  ],
  toneAdjustments: {
    moreOpinionated: true,
    moreTechnical: true,
    includeCodeExamples: true,
    comparisonTables: true,
  },
  bestPostingTimes: {
    "x-twitter": "14:00",
    linkedin: "09:00",
    reddit: "16:00",
  },
  redditTargets: [
    "r/LocalLLaMA",
    "r/LLMDevs",
    "r/MachineLearning",
    "r/artificial",
    "r/OpenAI",
    "r/ClaudeAI",
    "r/SideProject",
    "r/SaaS",
    "r/indiehackers",
    "r/MLOps",
  ],
  explorationBudget: 0.2,
  updatedAt: new Date().toISOString(),
  changelog: "Initial strategy — default weights",
};
