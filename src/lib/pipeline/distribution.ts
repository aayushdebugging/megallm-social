import type { Platform } from "./types";

// ─────────────────────────────────────────────────────────────
// Anti-spam distribution rules
//
// Each blog post goes to ONE blog platform only (not all).
// Social posts go to max 2 social platforms per content item.
// Rotation ensures no platform gets hit every single time.
// ─────────────────────────────────────────────────────────────

/** Blog platforms that host long-form content */
export const BLOG_PLATFORMS: Platform[] = [
  "blog",      // Own site (megallm.io)
  "devto",     // Dev.to
  "hashnode",  // Hashnode
  "medium",    // Medium
];

/** Social platforms for short-form promotion */
export const SOCIAL_PLATFORMS: Platform[] = [
  "x-twitter",
  "linkedin",
  "reddit",
  "hackernews",
];

/** Content rewrite style per platform (so posts don't look identical) */
export const PLATFORM_STYLE: Record<Platform, {
  maxWords: number;
  tone: string;
  uniqueAngle: string;
}> = {
  "blog":       { maxWords: 2500, tone: "authoritative, data-driven", uniqueAngle: "comprehensive reference with MegaLLM examples" },
  "devto":      { maxWords: 1500, tone: "developer peer, code-heavy", uniqueAngle: "practical tutorial with working code snippets" },
  "hashnode":   { maxWords: 2000, tone: "technical deep-dive", uniqueAngle: "architecture and design decisions" },
  "medium":     { maxWords: 1600, tone: "accessible, story-driven", uniqueAngle: "broader audience, less jargon, real-world impact" },
  "telegraph":  { maxWords: 800,  tone: "concise summary", uniqueAngle: "TL;DR version with key takeaways" },
  "x-twitter":  { maxWords: 50,   tone: "hook-first, punchy", uniqueAngle: "hot take or surprising stat" },
  "linkedin":   { maxWords: 250,  tone: "professional insight", uniqueAngle: "business impact and ROI framing" },
  "reddit":     { maxWords: 400,  tone: "authentic, non-promotional", uniqueAngle: "community discussion, ask for feedback" },
  "hackernews": { maxWords: 80,   tone: "factual, no hype", uniqueAngle: "technical substance, link to own blog" },
};

// ─────────────────────────────────────────────────────────────
// Content length targets by type (from SEO research)
// ─────────────────────────────────────────────────────────────

export const WORD_COUNT_TARGETS: Record<string, {
  min: number;
  max: number;
  aioPassageLength: number;
  notes: string;
}> = {
  "comparison":       { min: 2000, max: 2800, aioPassageLength: 150, notes: "Summary table + 150-word verdict per model" },
  "guide":            { min: 1800, max: 2500, aioPassageLength: 150, notes: "Front-load answer, comparison table, FAQ at end" },
  "tutorial":         { min: 1500, max: 2000, aioPassageLength: 120, notes: "Code blocks + 100-word explanations per step" },
  "thought-leadership": { min: 800, max: 1500, aioPassageLength: 200, notes: "Key argument in opening 200 words" },
  "case-study":       { min: 2000, max: 2500, aioPassageLength: 150, notes: "Results section with numbers" },
  "educational":      { min: 1500, max: 2100, aioPassageLength: 150, notes: "H2 sections as self-contained answers" },
  "news":             { min: 400, max: 800,   aioPassageLength: 100, notes: "Speed matters — publish within hours" },
  "pillar":           { min: 3000, max: 4500, aioPassageLength: 150, notes: "Ultimate reference, link magnet" },
};

/**
 * Get word count target for a content type.
 * Falls back to "guide" defaults for unknown types.
 */
export function getWordCountTarget(contentType: string) {
  return WORD_COUNT_TARGETS[contentType] ?? WORD_COUNT_TARGETS["guide"];
}

// ─────────────────────────────────────────────────────────────
// Distribution logic
// ─────────────────────────────────────────────────────────────

let _blogRotationIndex = 0;
let _socialRotationIndex = 0;

/**
 * Assign distribution targets for a content item.
 * 
 * ⚠️ CURRENT MODE: DEV.TO ONLY (NO BLOG)
 * Rules:
 * 1. Dev.to ONLY - single post per content item
 * 2. NO blog, no rotation, no other platforms
 * 3. NO social platforms (Twitter/LinkedIn/Reddit/HackerNews are skipped)
 */
export function assignDistribution(contentType: string): {
  blogTargets: Platform[];
  socialTargets: Platform[];
} {
  // Dev.to exclusive mode
  const blogTargets: Platform[] = ["devto"]; // ← ONLY DEV.TO
  const socialTargets: Platform[] = []; // ← SKIP ALL SOCIAL PLATFORMS

  return { blogTargets, socialTargets };
}

/**
 * Get platform-specific rewrite instructions for a blog post.
 * Each platform gets a DIFFERENT version of the same topic.
 */
export function getRewriteInstructions(platform: Platform, topic: string): string {
  const style = PLATFORM_STYLE[platform];
  if (!style) return `Write about: ${topic}`;

  return `Rewrite this topic for ${platform}.
Topic: ${topic}
Max words: ${style.maxWords}
Tone: ${style.tone}
Unique angle: ${style.uniqueAngle}

IMPORTANT: This must be a UNIQUE version — not a copy of what was posted elsewhere.
Change the structure, lead with a different hook, use different examples.
The core information can overlap but the presentation must be distinct.`;
}
