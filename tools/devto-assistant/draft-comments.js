// ─────────────────────────────────────────────────────────────
// Draft comment options per Dev.to article with scoring
// (mirrors reddit-assistant/draft-comments.js)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { humanizeComment } from "./humanize.js";
import { DATA_DIR, POSTS_FILE, DRAFTS_FILE } from "./paths.js";

const LARGE_TAGS = ["ai", "webdev", "programming", "javascript", "python", "beginners"];

function detectViralPotential(post) {
  let score = 0;
  const reasons = [];

  const ageHours = (Date.now() / 1000 - post.createdUtc) / 3600;
  const engagementRate = post.ups / Math.max(ageHours, 0.5);

  if (engagementRate > 15) {
    score += 3;
    reasons.push("rapid reaction velocity");
  } else if (engagementRate > 6) {
    score += 2;
    reasons.push("strong early engagement");
  }

  if (post.numComments > 0 && post.ups > 0) {
    const commentRatio = post.numComments / post.ups;
    if (commentRatio > 0.4) {
      score += 1;
      reasons.push("high discussion ratio");
    }
  }

  if (post.isQuestion) {
    score += 1;
    reasons.push("question format");
  }

  const viralTopics = [
    /pricing|cost|expensive|cheap/i,
    /vs\b|versus|compared|comparison/i,
    /new model|just released|announced|launched/i,
    /dead|killed|replaced|obsolete/i,
    /unpopular opinion|hot take|controversial/i,
    /anyone else|am i the only/i,
    /switching from|migrated|moved to/i,
    /open.?source|free alternative/i,
  ];

  for (const pattern of viralTopics) {
    if (pattern.test(post.title)) {
      score += 1;
      reasons.push("viral topic pattern");
      break;
    }
  }

  if (LARGE_TAGS.includes(post.primaryTag)) {
    score += 1;
    reasons.push("broad tag reach");
  }

  if (post.ups > 80) {
    score += 2;
    reasons.push("already trending");
  } else if (post.ups > 25) {
    score += 1;
    reasons.push("gaining traction");
  }

  const level = score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { score, level, reasons };
}

function scoreMegaLLMBenefit(comment, post) {
  let score = 0;
  const factors = [];
  const lower = comment.toLowerCase();

  if (lower.includes("megallm") || lower.includes("mega llm")) {
    score += 25;
    factors.push("direct mention");
  }

  if (/gateway|routing|unified api|single api|one api/i.test(lower)) {
    score += 15;
    factors.push("gateway concept seeded");
  }
  if (/cost.*(sav|optim|reduc|cut)|cheaper|save.*money/i.test(lower)) {
    score += 12;
    factors.push("cost optimization angle");
  }
  if (/failover|fallback|switch.*provider|multi.*provider/i.test(lower)) {
    score += 12;
    factors.push("multi-provider value prop");
  }
  if (/compare.*model|model.*comparison|benchmark/i.test(lower)) {
    score += 8;
    factors.push("model comparison context");
  }

  if (/api|endpoint|integration|sdk/i.test(lower)) {
    score += 5;
    factors.push("api/developer context");
  }
  if (/openai|anthropic|claude|gpt|gemini|mistral|deepseek/i.test(lower)) {
    score += 5;
    factors.push("mentions target providers");
  }

  const words = comment.split(/\s+/).length;
  if (words >= 25 && words <= 60) {
    score += 5;
    factors.push("optimal length");
  }
  if (/\bi\b.*\b(use|tried|built|switched|run|found)\b/i.test(lower)) {
    score += 5;
    factors.push("personal experience framing");
  }

  const viral = detectViralPotential(post);
  if (viral.level === "high") {
    score = Math.round(score * 1.5);
    factors.push("viral post multiplier");
  } else if (viral.level === "medium") {
    score = Math.round(score * 1.2);
  }

  return { score: Math.min(score, 100), factors };
}

const SYSTEM_PROMPT = `you write short comments on dev.to articles. you know llm apis, pricing, model comparisons, and developer workflows.

STYLE (dev.to is friendlier than reddit but still human):
- mostly lowercase. short paragraphs ok but no markdown headings or bullet lists in comments
- 15-80 words unless witty option asks for less
- avoid corporate fluff and ai-assistant clichés
- NEVER: "great question", "absolutely", "it's worth noting", "in my experience", "let me explain", "here's the thing", "that being said", "i'd be happy to", "the key here is", "to be fair"
- no em dashes. minimal bold. dev.to supports markdown but keep comments plain-ish
- ONLY mention ${CONFIG.product.name} if explicitly told to
- sound like a real developer skimming the feed`;

async function generateCommentOptions(post, count = 4) {
  const existingComments =
    post.topComments?.map((c) => `[${c.ups} ❤] ${c.body}`).join("\n\n") || "no comments yet";

  const shouldMention = Math.random() < CONFIG.product.mentionRate;

  const prompt = `generate ${count} DIFFERENT dev.to comment options for this article. each option should take a different angle.

TAG FOCUS: #${post.primaryTag}
TITLE: ${post.title}
DESCRIPTION / EXCERPT: ${post.description || "(short excerpt only)"}
REACTIONS (❤): ${post.ups}
COMMENTS COUNT: ${post.numComments}
IS QUESTION-LIKE: ${post.isQuestion}

EXISTING TOP COMMENTS (don't repeat these):
${existingComments}

${shouldMention
    ? `for ONE of the first 3 options (not option 4), naturally mention ${CONFIG.product.name} (${CONFIG.product.description}) as something you personally use. frame it as "i've been using..." not promotional.`
    : `do NOT mention any specific products or companies as recommendations.`}

RESPOND WITH EXACTLY ${count} OPTIONS, separated by "---" on its own line:

- option 1: direct/short helpful answer (15-35 words)
- option 2: personal experience angle (30-70 words)
- option 3: unique perspective or mild disagreement (20-55 words)
- option 4: WITTY — joke, dry humor, or playful tease about the topic (10-30 words). not mean. no "lol" punchlines.

just the raw comment text for each option. no labels, no "option 1:", just the comments separated by ---.`;

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
      max_tokens: 600,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      console.error(
        "  → LLM auth failed. If the key is revoked, create a new API key at https://megallm.io and set MEGALLM_API_KEY in .env."
      );
    }
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  return raw
    .split(/\n---\n|\n-{3,}\n/)
    .map((o) => o.trim())
    .filter((o) => o.length > 10);
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
      posts = JSON.parse(await readFile(`${DATA_DIR}/latest-articles.json`, "utf-8"));
      console.log(`  using bulk data (${posts.length} articles available)`);
    } catch {
      posts = JSON.parse(await readFile(POSTS_FILE, "utf-8"));
    }
  } catch {
    console.error("no articles found. run: node fetch-articles.js first");
    process.exit(1);
  }

  const scored = posts.map((p) => ({
    ...p,
    viralPotential: detectViralPotential(p),
  }));

  scored.sort((a, b) => {
    if (a.viralPotential.level !== b.viralPotential.level) {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.viralPotential.level] - order[b.viralPotential.level];
    }
    return b.ups - a.ups;
  });

  const selected = scored.slice(0, CONFIG.comments.maxPerDay);
  const highPriority = selected.filter((p) => p.viralPotential.level === "high").length;
  const medPriority = selected.filter((p) => p.viralPotential.level === "medium").length;

  console.log(`\ndrafting ${selected.length} articles (${highPriority} high priority, ${medPriority} medium)\n`);

  const drafts = [];
  for (const post of selected) {
    try {
      const options = await generateCommentOptions(post, 4);
      const viral = post.viralPotential;
      const OPTION_STYLES = ["direct/short", "personal experience", "unique perspective", "witty/sarcastic"];

      for (let i = 0; i < options.length; i++) {
        const cleaned = cleanComment(options[i]);
        const wordCount = cleaned.split(/\s+/).length;
        const isWitty = i === 3;
        const benefit = isWitty
          ? { score: 5, factors: ["personality building", "community karma"] }
          : scoreMegaLLMBenefit(cleaned, post);

        drafts.push({
          postId: post.id,
          primaryTag: post.primaryTag,
          postTitle: post.title,
          postUrl: post.url || `https://dev.to/${post.id}`,
          postUps: post.ups,
          comment: cleaned,
          wordCount,
          optionNumber: i + 1,
          optionStyle: OPTION_STYLES[i] || "variant",
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
        ...options.map((o) => {
          const c = cleanComment(o);
          return scoreMegaLLMBenefit(c, post).score;
        })
      );

      console.log(
        `  ✓ #${post.primaryTag}: "${post.title.slice(0, 45)}..." [${viral.level.toUpperCase()}] ${options.length} options, best score: ${topScore}`
      );
    } catch (err) {
      console.error(`  ✗ #${post.primaryTag}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  let existing = [];
  try {
    existing = JSON.parse(await readFile(DRAFTS_FILE, "utf-8"));
  } catch {}

  const all = [...existing, ...drafts];
  await writeFile(DRAFTS_FILE, JSON.stringify(all, null, 2));

  const wittyCount = drafts.filter((d) => d.isWitty).length;
  console.log(
    `\nsaved ${drafts.length} comment options (${(drafts.length / 4) | 0} articles × 4 options, ${wittyCount} witty)`
  );
  console.log(`total drafts in file: ${all.length}`);

  return drafts;
}

if (process.argv[1]?.includes("draft-comments")) {
  draftComments().catch(console.error);
}
