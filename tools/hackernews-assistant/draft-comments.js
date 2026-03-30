// ─────────────────────────────────────────────────────────────
// Draft HN-style reply options (MegaLLM) — mirrors devto-assistant flow
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { humanizeComment } from "./humanize.js";
import { DATA_DIR, POSTS_FILE, DRAFTS_FILE } from "./paths.js";

function hnItemUrl(id) {
  return `https://news.ycombinator.com/item?id=${id}`;
}

function detectViralPotential(post) {
  let score = 0;
  const reasons = [];

  const ageHours = (Date.now() / 1000 - post.createdUtc) / 3600;
  const velocity = post.ups / Math.max(ageHours, 0.25);

  if (velocity > 25) {
    score += 3;
    reasons.push("fast point gain");
  } else if (velocity > 10) {
    score += 2;
    reasons.push("strong early votes");
  }

  if (post.numComments > 0 && post.ups > 0) {
    const ratio = post.numComments / post.ups;
    if (ratio > 0.35) {
      score += 1;
      reasons.push("busy thread");
    }
  }

  if (post.isQuestion || post.primaryTag === "ask") {
    score += 1;
    reasons.push("discussion / ask format");
  }

  const viralTopics = [
    /pricing|cost|expensive|cheap|free tier/i,
    /vs\b|versus|compared|benchmark/i,
    /openai|anthropic|claude|gpt|llm|gpu|cuda/i,
    /startup|yc|hiring|layoff/i,
    /security|breach|vulnerability/i,
    /rust|linux|kernel/i,
  ];

  for (const pattern of viralTopics) {
    if (pattern.test(post.title)) {
      score += 1;
      reasons.push("hot topic pattern");
      break;
    }
  }

  if (post.primaryTag === "show" || post.primaryTag === "ask") {
    score += 1;
    reasons.push("show/ask visibility");
  }

  if (post.ups > 120) {
    score += 2;
    reasons.push("front-page level");
  } else if (post.ups > 40) {
    score += 1;
    reasons.push("gaining traction");
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
  if (/gateway|unified api|single api|one api|route.*provider/i.test(lower)) {
    s += 15;
    factors.push("gateway angle");
  }
  if (/cost|token|pricing|bill|cheaper/i.test(lower)) {
    s += 10;
    factors.push("cost / infra angle");
  }
  if (/api|latency|throughput|inference|model/i.test(lower)) {
    s += 6;
    factors.push("technical hn relevance");
  }
  if (/\bi\b.*\b(use|tried|ran|built|switched)\b/i.test(lower)) {
    s += 5;
    factors.push("experience framing");
  }

  const words = comment.split(/\s+/).length;
  if (words >= 20 && words <= 55) {
    s += 5;
    factors.push("hn-typical length");
  }

  const viral = detectViralPotential(post);
  if (viral.level === "high") s = Math.round(s * 1.45);
  else if (viral.level === "medium") s = Math.round(s * 1.15);

  return { score: Math.min(s, 100), factors };
}

const SYSTEM_PROMPT = `you write hacker news comments. tone: smart engineer, concise, sometimes skeptical, no marketing voice.

RULES:
- mostly lowercase. no markdown headers or bullet lists
- 12-80 words per option unless witty option is shorter
- avoid startup-bro clichés and llm-speak
- NEVER: "great question", "absolutely", "it's worth noting", "in my experience", "let me explain", "here's the thing", "that being said", "i'd be happy to", "the key here is", "to be fair"
- no em dashes. avoid sounding like an assistant
- ONLY mention ${CONFIG.product.name} if the user prompt explicitly allows a product mention for one option
- hn comments are often dry humor or one sharp observation — option 4 should lean that way`;

async function generateCommentOptions(post, count = 4) {
  const existing =
    post.topComments
      ?.map((c) => `[${c.author}] ${c.body}`)
      .join("\n\n") || "no sample comments loaded";

  const shouldMention = Math.random() < CONFIG.product.mentionRate;

  const prompt = `write ${count} DIFFERENT top-level comment options for this hacker news thread. each a different angle.

KIND: ${post.primaryTag} (story | ask | show | tell)
TITLE: ${post.title}
LINK OR DISCUSSION: ${post.url}
POINTS: ${post.ups}  COMMENTS: ${post.numComments}
SUBMITTER (context only): ${post.by || "unknown"}

EXISTING TOP-LEVEL SNIPPETS (do not copy):
${existing}

${shouldMention
    ? `for ONE of the first 3 options only (not option 4), naturally mention ${CONFIG.product.name} (${CONFIG.product.description}) as something you use — one factual line, not an ad.`
    : `do NOT name or promote any specific commercial product.`}

FORMAT: exactly ${count} options separated by a line containing only ---

- 1: shortest helpful or clarifying reply (15-35 words)
- 2: experience or "i tried / we shipped" angle (25-60 words)
- 3: disagree, caveat, or missing angle (20-50 words)
- 4: dry wit or hn-style joke about the topic (8-28 words). not mean spirited.

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
      max_tokens: 650,
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
    .filter((o) => o.length > 8);
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
    try {
      posts = JSON.parse(await readFile(`${DATA_DIR}/latest-stories.json`, "utf-8"));
      console.log(`  using bulk data (${posts.length} stories)`);
    } catch {
      posts = JSON.parse(await readFile(POSTS_FILE, "utf-8"));
    }
  } catch {
    console.error("no stories found. run: node fetch-stories.js first");
    process.exit(1);
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
      const styles = ["direct/short", "experience", "pushback/caveat", "witty/hn"];

      for (let i = 0; i < options.length; i++) {
        const cleaned = cleanComment(options[i]);
        const wordCount = cleaned.split(/\s+/).length;
        const isWitty = i === 3;
        const benefit = isWitty
          ? { score: 5, factors: ["personality", "hn karma"] }
          : scoreMegaLLMBenefit(cleaned, post);

        drafts.push({
          postId: post.id,
          primaryTag: post.primaryTag,
          postTitle: post.title,
          postUrl: hnItemUrl(post.id),
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
        `  ✓ [${post.primaryTag}] ${post.ups}pts: "${post.title.slice(0, 44)}..." [${viral.level.toUpperCase()}] best score ${topScore}`
      );
    } catch (err) {
      console.error(`  ✗ ${post.id}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  let existing = [];
  try {
    existing = JSON.parse(await readFile(DRAFTS_FILE, "utf-8"));
  } catch {}

  const all = [...existing, ...drafts];
  await writeFile(DRAFTS_FILE, JSON.stringify(all, null, 2));

  console.log(
    `\nsaved ${drafts.length} options (${(drafts.length / 4) | 0} threads × 4) · total in file: ${all.length}\n`
  );
  return drafts;
}

if (process.argv[1]?.includes("draft-comments")) {
  draftComments().catch(console.error);
}
