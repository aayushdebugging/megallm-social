// ─────────────────────────────────────────────────────────────
// Smart Tweet Orchestration for MegaLLM
// Intelligently selects search queries based on audience analysis
// Target: AI developers, LLM users, API enthusiasts
// Competitors: OpenRouter, Groq, TogetherAI, Anthropic, OpenAI
// Language: ENGLISH ONLY (no Chinese, Arabic, or other non-English content)
// ─────────────────────────────────────────────────────────────

export const ORCHESTRATION = {
  // Primary Core Topics (highest priority - direct user pain points)
  coreTopics: [
    "llm api gateway",        // Direct product keyword
    "unified llm api",        // Core value proposition
    "llm routing",            // Smart routing capability
    "llm fallback",           // Reliability feature
    "ai api cost",            // Pain point: costs
  ],

  // Secondary: Competitor Monitoring (know the landscape)
  competitorTopics: [
    "openrouter",             // Direct competitor
    "groq api",               // Competitor - fast inference
    "together ai",            // Competitor - open models
    "anthropic claude",       // API alternative
    "openai alternatives",    // Market trend
  ],

  // Tertiary: Broader AI/LLM Interest (awareness, ecosystem)
  ecoSystemTopics: [
    "llm inference",          // Core capability
    "language model api",     // Broader search
    "ai model availability",  // Related problem
    "llm cost optimization",  // Pain point
    "api key management",     // Related concern
  ],

  // Quaternary: Emerging Trends (stay ahead)
  trendingTopics: [
    "serverless llm",         // Infrastructure trend
    "ai observability",       // Related services
    "prompt engineering",     // Developer interest
    "rag api",                // Related technology
    "function calling llm",   // Related feature
  ],

  // Quinary: Audience Engagement (find decision makers)
  audienceTopics: [
    "ai startup",             // Founder/entrepreneur
    "ml engineering",         // Technical professionals
    "developer tools",        // Tool adoption mindset
    "api marketplace",        // Enterprise interest
    "open source llm",        // Community/OSS users
  ],

  // Quality Filters
  filters: {
    minFaves: 5,              // Minimum 5 likes for quality
    minReplies: 0,            // Any reply count
    minRetweets: 0,           // Don't filter retweets
    languageOnly: "en",       // ENGLISH ONLY - excludes Chinese, Arabic, etc.
  },

  // Execution Strategy
  strategy: {
    // Phase 1: Core (must get these)
    phase1: {
      topics: "coreTopics",
      maxPerQuery: 4,           // 4 tweets per query = 20 tweets
      priorityLevel: "critical",
      description: "High-value tweets about core product capability",
    },
    
    // Phase 2: Competitors (know the enemy)
    phase2: {
      topics: "competitorTopics",
      maxPerQuery: 3,           // 3 tweets per query = 15 tweets
      priorityLevel: "high",
      description: "Monitor competitor mentions and market positioning",
    },
    
    // Phase 3: Ecosystem (build context)
    phase3: {
      topics: "ecoSystemTopics",
      maxPerQuery: 3,           // 3 tweets per query = 15 tweets
      priorityLevel: "medium",
      description: "Broader LLM/AI ecosystem discussions",
    },

    // Phase 4: Trending (stay relevant)
    phase4: {
      topics: "trendingTopics",
      maxPerQuery: 2,           // 2 tweets per query = 10 tweets
      priorityLevel: "medium",
      description: "Emerging trends and related technologies",
    },

    // Phase 5: Audience (engagement opportunities)
    phase5: {
      topics: "audienceTopics",
      maxPerQuery: 2,           // 2 tweets per query = 10 tweets
      priorityLevel: "low",
      description: "Find target audience discussions",
    },
  },

  // Total Expected: ~70 high-quality tweets across all phases
  // With min_faves:5 filter, expect ~50-60 quality tweets
  
  metadata: {
    usecase: "MegaLLM - Unified LLM API Gateway",
    targetAudience: ["AI developers", "LLM users", "API enthusiasts", "DevOps engineers", "Startup founders"],
    competitors: ["OpenRouter", "Groq", "TogetherAI"],
    relatedTopics: ["Anthropic", "OpenAI", "inference optimization", "API cost reduction"],
    createdAt: new Date().toISOString(),
    version: "1.0",
  },
};

/**
 * Get all search queries based on orchestration
 */
export function getAllSearchQueries() {
  const queries = [];
  const orch = ORCHESTRATION;

  // Collect all topics
  for (const topicKey of Object.keys(ORCHESTRATION)) {
    if (Array.isArray(ORCHESTRATION[topicKey])) {
      queries.push(...ORCHESTRATION[topicKey]);
    }
  }

  return queries;
}

/**
 * Get queries by phase (for progressive fetching if needed)
 */
export function getQueriesByPhase(phaseNumber) {
  const phaseKey = `phase${phaseNumber}`;
  const phase = ORCHESTRATION.strategy[phaseKey];
  
  if (!phase) return [];
  
  const topicArray = ORCHESTRATION[phase.topics];
  return topicArray || [];
}

/**
 * Get quality filter settings
 */
export function getFilters() {
  return ORCHESTRATION.filters;
}

/**
 * Get orchestration metadata
 */
export function getMetadata() {
  return ORCHESTRATION.metadata;
}

// Export for testing
export default ORCHESTRATION;
