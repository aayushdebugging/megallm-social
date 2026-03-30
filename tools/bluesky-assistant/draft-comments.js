// ─────────────────────────────────────────────────────────────
// Draft Bluesky reply options (MegaLLM)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG, validateLlm } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { humanizeComment } from "../hackernews-assistant/humanize.js";
import { DATA_DIR, POSTS_FILE, DRAFTS_FILE } from "./paths.js";

function detectViralPotential(post) {
  let score = 0;
  const reasons = [];

  const ageHours = (Date.now() / 1000 - post.createdUtc) / 3600;
  const velocity = post.ups / Math.max(ageHours, 0.25);

  if (velocity > 80) {
    score += 3;
    reasons.push("fast likes");
  } else if (velocity > 25) {
    score += 2;
    reasons.push("strong engagement");
  }

  if (post.numComments > 0 && post.ups > 0) {
    const ratio = post.numComments / post.ups;
    if (ratio > 0.2) {
      score += 1;
      reasons.push("active thread");
    }
  }

  if (post.ups > 500) {
    score += 2;
    reasons.push("high reach");
  } else if (post.ups > 80) {
    score += 1;
    reasons.push("solid traction");
  }

  const viralTopics = [
    /ai\b|llm|gpt|claude|open source|startup|infra|gpu/i,
    /breaking|news|policy|election/i,
    /music|film|game|sports/i,
  ];
  for (const pattern of viralTopics) {
    if (pattern.test(post.title)) {
      score += 1;
      reasons.push("topic momentum");
      break;
    }
  }

  const level = score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { score, level, reasons };
}

function scoreMegaLLMBenefit(comment, post) {
  let s = 0;
  const factors = [];
  const lower = comment.toLowerCase();

  if (lower.includes("megallm") || lower.includes("mega llm")) {
    s += 25;
    factors.push("direct mention");
  }
  if (/gateway|unified api|one api|route.*provider/i.test(lower)) {
    s += 15;
    factors.push("gateway angle");
  }
  if (/model|inference|api|latency|token/i.test(lower)) {
    s += 8;
    factors.push("tech relevance");
  }
  if (/\bi\b.*\b(use|tried|ran|shipped)\b/i.test(lower)) {
    s += 5;
    factors.push("personal voice");
  }

  const words = comment.split(/\s+/).length;
  if (words >= 8 && words <= 80) {
    s += 6;
    factors.push("bsky length");
  }

  const viral = detectViralPotential(post);
  if (viral.level === "high") s = Math.round(s * 1.4);
  else if (viral.level === "medium") s = Math.round(s * 1.12);

  return { score: Math.min(s, 100), factors };
}

const SYSTEM_PROMPT = `you write bluesky replies. tone: casual, human, sometimes funny — never corporate or lecture-y.

RULES:
- mostly lowercase. no markdown headers or numbered lists in the reply
- bluesky favors short paragraphs or one-liners; keep each option tight
- avoid startup-bro clichés and llm-speak
- NEVER: "great question", "absolutely", "it's worth noting", "in my experience", "let me explain", "here's the thing", "that being said", "i'd be happy to", "to be fair"
- no em dashes. avoid sounding like an assistant
- ONLY mention ${CONFIG.product.name} if the user prompt explicitly allows a product mention for one option
- option 4 can be dry wit or a single sharp line — still kind, not cruel`;

async function generateCommentOptions(post, count = 4) {
  validateLlm();

  const existing =
    post.topComments
      ?.map((c) => `[@${c.author}] ${c.body}`)
      .join("\n\n") || "no sample replies loaded";

  const shouldMention = Math.random() < CONFIG.product.mentionRate;

  const prompt = `write ${count} DIFFERENT reply options for this bluesky post. each a different angle — all are direct replies to the author (not quote-dunking).

AUTHOR: @${post.by}
POST TEXT:
${post.title}

LIKES: ${post.ups}  REPLIES: ${post.numComments}
OPEN IN APP: ${post.url}

EXISTING REPLY SNIPPETS (do not copy):
${existing}

${shouldMention
    ? `for ONE of the first 3 options only (not option 4), naturally mention ${CONFIG.product.name} (${CONFIG.product.description}) — one factual line, not an ad.`
    : `do NOT name or promote any specific commercial product.`}

FORMAT: exactly ${count} options separated by a line containing only ---

- 1: shortest warm or thoughtful reply (10-40 words)
- 2: "yeah i" / experience angle (20-70 words)
- 3: gentle pushback, question, or missing angle (15-55 words)
- 4: witty or dry one-liner / two short lines (6-35 words)

raw text only. no "option 1:" labels.`;

  const res = await fetch(`${CONFIG.apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 700,
      temperature: 0.88,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      console.error(
        "  → LLM auth failed. Mint a new key at https://megallm.io and set MEGALLM_API_KEY in .env."
      );
    }
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  return raw
    .split(/\n---\n|\n-{3,}\n/)
    .map((o) => o.trim())
    .filter((o) => o.length > 6);
}

function cleanComment(text) {
  let cleaned = text
    .replace(/—/g, ",")
    .replace(/\*\*.*?\*\*/g, (m) => m.replace(/\*/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(option \d+[:\s]*)/i, "")
    .trim();

  cleaned = CONFIG.comments.forceLowercase ? humanizeComment(cleaned) : cleaned;
  return cleaned;
}

export async function draftComments() {
  await mkdir(DATA_DIR, { recursive: true });

  let posts;
  try {
    posts = JSON.parse(await readFile(POSTS_FILE, "utf-8"));
  } catch {
    throw new Error("No posts cached. Run fetch first (node fetch-feed.js).");
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("posts.json is empty. Run fetch first.");
  }

  const scored = posts.map((p) => ({ ...p, viralPotential: detectViralPotential(p) }));

  scored.sort((a, b) => {
    if (a.viralPotential.level !== b.viralPotential.level) {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.viralPotential.level] - order[b.viralPotential.level];
    }
    return b.ups - a.ups;
  });

  const selected = scored.slice(0, CONFIG.comments.maxPerDay);
  const hi = selected.filter((p) => p.viralPotential.level === "high").length;
  const med = selected.filter((p) => p.viralPotential.level === "medium").length;

  console.log(`\ndrafting ${selected.length} threads (${hi} high, ${med} medium)\n`);

  const drafts = [];
  for (const post of selected) {
    try {
      const options = await generateCommentOptions(post, 4);
      const viral = post.viralPotential;
      const styles = ["short/warm", "experience", "pushback/question", "witty/bsky"];

      for (let i = 0; i < options.length; i++) {
        const cleaned = cleanComment(options[i]);
        const wordCount = cleaned.split(/\s+/).length;
        const isWitty = i === 3;
        const benefit = isWitty
          ? { score: 5, factors: ["personality", "bsky tone"] }
          : scoreMegaLLMBenefit(cleaned, post);

        drafts.push({
          postId: post.id,
          primaryTag: post.primaryTag,
          postTitle: post.title,
          postUrl: post.url,
          postUps: post.ups,
          comment: cleaned,
          wordCount,
          optionNumber: i + 1,
          optionStyle: styles[i] || "variant",
          isWitty,
          megallmScore: benefit.score,
          megallmFactors: benefit.factors,
          viralPotential: viral.level,
          viralReasons: viral.reasons,
          mentionsProduct: cleaned.includes(CONFIG.product.name.toLowerCase()),
          status: "draft",
          createdAt: new Date().toISOString(),
        });
      }

      const topScore = Math.max(
        ...options.map((o) => scoreMegaLLMBenefit(cleanComment(o), post).score)
      );
      console.log(
        `  ✓ [@${post.by}] ${post.ups}♥: "${post.title.slice(0, 44)}..." [${viral.level.toUpperCase()}] best score ${topScore}`
      );
    } catch (err) {
      console.error(`  ✗ ${post.id}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  let existing = [];
  try {
    existing = JSON.parse(await readFile(DRAFTS_FILE, "utf-8"));
  } catch {
    /* empty */
  }

  const all = [...existing, ...drafts];
  await writeFile(DRAFTS_FILE, JSON.stringify(all, null, 2));

  console.log(
    `\nsaved ${drafts.length} options (${(drafts.length / 4) | 0} posts × 4) · total in file: ${all.length}\n`
  );
  return drafts;
}

if (process.argv[1]?.includes("draft-comments")) {
  draftComments().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
