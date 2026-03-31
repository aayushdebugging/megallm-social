// ─────────────────────────────────────────────────────────────
// Draft reply options for X tweets with engagement scoring
// Generates 3 options per tweet, scores for relevance + virality
// ─────────────────────────────────────────────────────────────

import "./load-env.js"; // Load .env before importing config
import { CONFIG } from "./config.js";
import { humanizeReply } from "./humanize.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, TWEETS_FILE, DRAFTS_FILE } from "./paths.js";

// Import AI SDK
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

function getMegaLLM() {
  const apiKey = CONFIG.apiKey;

  const fetchWithAuth = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.delete("authorization");
    headers.delete("Authorization");
    headers.set("Authorization", `Bearer ${apiKey}`);

    return fetch(url, {
      ...options,
      headers,
    });
  };

  return createOpenAI({
    apiKey,
    baseURL: CONFIG.apiBaseUrl,
    fetch: fetchWithAuth,
  });
}

// ── Relevance scoring ───────────────────────────────

function scoreMegaLLMRelevance(reply, tweet) {
  let score = 0;
  const factors = [];
  const lower = reply.toLowerCase();

  // Direct mention
  if (lower.includes("megallm") || lower.includes("mega llm")) {
    score += 25;
    factors.push("direct mention");
  }

  // Mentions value props (gateway, routing, unified api, cost savings)
  if (/gateway|routing|unified api|single api|cost|optimization/i.test(lower)) {
    score += 15;
    factors.push("value prop mention");
  }

  // Dialogue/question response (high engagement)
  if (reply.includes("?") || lower.includes("why") || lower.includes("how")) {
    score += 8;
    factors.push("question format");
  }

  // Personal experience/insight (more credible)
  if (/tried|used|built|worked with/i.test(lower)) {
    score += 10;
    factors.push("personal experience");
  }

  // Competitive mention (OpenRouter, LiteLLM, Portkey, etc.)
  if (/openrouter|litellm|portkey|helicone|martian/i.test(lower)) {
    score += 12;
    factors.push("competitor mention");
  }

  return {
    score: Math.max(0, score),
    factors,
  };
}

// ── Engagement potential ───────────────────────────────

function detectEngagementPotential(tweet) {
  let score = 0;
  const reasons = [];

  // High engagement ratio
  if (tweet.replies > 0 && tweet.likes > 0) {
    const engagementRate = tweet.replies / tweet.likes;
    if (engagementRate > 0.5) {
      score += 3;
      reasons.push("high discussion");
    }
  }

  // Already trending (high likes)
  if (tweet.likes > 100) {
    score += 3;
    reasons.push("viral potential");
  } else if (tweet.likes > 20) {
    score += 1;
    reasons.push("gaining traction");
  }

  // Author influence
  if (tweet.authorVerified) {
    score += 2;
    reasons.push("verified author");
  }

  // Question tweets get more replies
  if (tweet.text.includes("?")) {
    score += 2;
    reasons.push("question format");
  }

  const level = score >= 5 ? "high" : score >= 2 ? "medium" : "low";
  return { score, level, reasons };
}

async function draftReplyOptions(tweet) {
  if (!CONFIG.apiKey) {
    throw new Error("MEGALLM_API_KEY not configured");
  }

  const megallm = getMegaLLM();
  const model = megallm("gpt-4o-mini"); // Try faster/more accessible model

  const engagement = detectEngagementPotential(tweet);

  const prompt = `
You are a helpful contributor on X (Twitter). Reply to this tweet in a natural, conversational way.
Generate 3 different reply options that could work. Be concise (under 60 words).

Tweet: "${tweet.text}"
Author: @${tweet.authorUsername}
Context: ${tweet.topReplies.length > 0 ? tweet.topReplies.map((r) => `• @${r.author}: "${r.text}"`).join("\n") : "(no replies yet)"}

Guidelines:
- Keep it under 280 characters (fits on X)
- Be natural and conversational
- Avoid corporate/AI-sounding language
- ${CONFIG.replies.avoid.map((phrase) => `Don't say "${phrase}"`).join("\n- ")}
- Only mention MegaLLM if genuinely relevant (~10% of replies)

Return valid JSON ONLY (no markdown, no explanation):
{
  "options": [
    { "text": "...", "type": "question|insight|agreement" },
    { "text": "...", "type": "question|insight|agreement" },
    { "text": "...", "type": "question|insight|agreement" }
  ]
}
`;

  // Retry logic with exponential backoff
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.8,
        maxTokens: 300,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`No JSON in response for tweet ${tweet.id}`);
        return [];
      }

      const data = JSON.parse(jsonMatch[0]);
      return data.options || [];
    } catch (err) {
      lastError = err;
      
      // If rate limited, wait much longer before retry
      if (err.message && err.message.includes("Too Many Requests")) {
        const waitMs = Math.pow(3, attempt) * 5000; // 15s, 45s, 135s
        console.log(`    ⏳ Rate limited. Waiting ${waitMs / 1000}s before retry...`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else if (attempt < 3) {
        // Other errors: quick retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.error(`Failed to draft replies for ${tweet.id}: ${lastError.message}`);
  return [];
}

export async function draftComments() {
  if (!CONFIG.apiKey) throw new Error("MEGALLM_API_KEY not set in .env");
  await mkdir(DATA_DIR, { recursive: true });

  console.log(`\nDrafting reply options for tweets...\n`);
  console.log(`⚠️  This will take ~2-3 minutes (respecting API rate limits)\n`);

  const tweetsData = await readFile(TWEETS_FILE, "utf8");
  const tweets = JSON.parse(tweetsData);

  const drafts = [];

  for (let i = 0; i < tweets.length && i < 15; i++) {
    const tweet = tweets[i];
    const engagement = detectEngagementPotential(tweet);

    console.log(
      `  [${i + 1}/${Math.min(tweets.length, 15)}] @${tweet.authorUsername} (${tweet.likes}❤, ${engagement.level} engagement)`
    );

    const options = await draftReplyOptions(tweet);

    for (const option of options) {
      const humanized = humanizeReply(option.text);
      const relevance = scoreMegaLLMRelevance(humanized, tweet);

      drafts.push({
        id: `draft-${tweet.id}-${Date.now()}`,
        tweetId: tweet.id,
        tweetText: tweet.text.slice(0, 200),
        authorUsername: tweet.authorUsername,
        replyText: humanized,
        replyType: option.type,
        megallmScore: relevance.score,
        engagementLevel: engagement.level,
        url: tweet.url,
        createdAt: new Date().toISOString(),
      });
    }

    // Rate limit: wait between tweets
    if (i < tweets.length - 1) {
      await new Promise((r) => setTimeout(r, 8000)); // 8 seconds between tweets for rate limiting
    }
  }

  await writeFile(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
  console.log(`\n✓ Drafted ${drafts.length} reply options to ${DRAFTS_FILE}\n`);
  return drafts;
}

// Run directly
if (process.argv[1]?.includes("draft-comments")) {
  draftComments().catch(console.error);
}
