// ─────────────────────────────────────────────────────────────
// Draft multiple comment options per post with scoring
// Generates 3 options per post, scores each for MegaLLM benefit,
// and tags posts with viral potential
// ─────────────────────────────────────────────────────────────

import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { humanizeComment } from "./humanize.js";
import { DATA_DIR, POSTS_FILE, DRAFTS_FILE } from "./paths.js";

// ── Viral potential detection ─────────────────────────────

function detectViralPotential(post) {
  let score = 0;
  const reasons = [];

  // High early engagement relative to age
  const ageHours = (Date.now() / 1000 - post.createdUtc) / 3600;
  const engagementRate = post.ups / Math.max(ageHours, 0.5);

  if (engagementRate > 20) {
    score += 3;
    reasons.push("rapid upvote velocity");
  } else if (engagementRate > 8) {
    score += 2;
    reasons.push("strong early engagement");
  }

  // High comment-to-upvote ratio = controversial/discussion-heavy
  if (post.numComments > 0 && post.ups > 0) {
    const commentRatio = post.numComments / post.ups;
    if (commentRatio > 0.5) {
      score += 1;
      reasons.push("high discussion ratio");
    }
  }

  // Question posts tend to get more engagement
  if (post.isQuestion) {
    score += 1;
    reasons.push("question format");
  }

  // Topics that tend to go viral in AI subreddits
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

  // Large subreddits have more viral potential
  const largeSubs = ["ChatGPT", "OpenAI", "singularity", "MachineLearning", "artificial", "Python", "Entrepreneur"];
  if (largeSubs.includes(post.subreddit)) {
    score += 1;
    reasons.push("large subreddit");
  }

  // Already trending
  if (post.ups > 50) {
    score += 2;
    reasons.push("already trending");
  } else if (post.ups > 20) {
    score += 1;
    reasons.push("gaining traction");
  }

  const level = score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { score, level, reasons };
}

// ── MegaLLM benefit scoring ──────────────────────────────

function scoreMegaLLMBenefit(comment, post) {
  let score = 0;
  const factors = [];
  const lower = comment.toLowerCase();

  // Direct product mention (highest value but rare)
  if (lower.includes("megallm") || lower.includes("mega llm")) {
    score += 25;
    factors.push("direct mention");
  }

  // Mentions our value props without naming us
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

  // Topical relevance to MegaLLM's market
  if (/api|endpoint|integration|sdk/i.test(lower)) {
    score += 5;
    factors.push("api/developer context");
  }
  if (/openai|anthropic|claude|gpt|gemini|mistral|deepseek/i.test(lower)) {
    score += 5;
    factors.push("mentions target providers");
  }

  // Comment quality signals (better comment = more visibility = more benefit)
  const words = comment.split(/\s+/).length;
  if (words >= 25 && words <= 60) {
    score += 5;
    factors.push("optimal length");
  }
  if (/\bi\b.*\b(use|tried|built|switched|run|found)\b/i.test(lower)) {
    score += 5;
    factors.push("personal experience framing");
  }

  // Post viral potential multiplier
  const viral = detectViralPotential(post);
  if (viral.level === "high") {
    score = Math.round(score * 1.5);
    factors.push("viral post multiplier");
  } else if (viral.level === "medium") {
    score = Math.round(score * 1.2);
  }

  return { score: Math.min(score, 100), factors };
}

// ── System prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `you write reddit comments. you know a lot about llm apis, pricing, model comparisons, and ai infrastructure.

DATA FROM ANALYZING 4,867 REAL REDDIT COMMENTS:

punctuation patterns (MATCH THESE):
- 39% of comments dont end with a period. just stop mid thought
- 55% have zero commas anywhere
- 3% skip apostrophes entirely (dont, cant, wont, isnt, its, im, ive, thats)
- only 6% use exclamation marks. almost nobody uses them
- 23% contain a question mark

common slang by frequency (USE THESE NATURALLY):
- probably(140x), lol(110x), honestly(82x), basically(74x), literally(67x)
- gonna(38x), lmao(29x), kinda(26x), imo(24x), idk(17x)
- tho(16x), tbh(15x), btw(15x), ppl(15x), gotta(10x)
- wanna(7x), nah(6x), fwiw(5x), bruh(4x), dunno(4x), bc(3x)

how comments actually start (MATCH THIS DISTRIBUTION):
- "i" (11%), "the" (4%), "this" (3%), "its" (2%), "yeah" (2%)
- "you" (2%), "it" (2%), "thats" (1%), "what" (1%), "if" (1%)
- "so" (1%), "no" (1%), "how" (1%), "my" (1%)

RULES:
1. ALL LOWERCASE. no capitals ever. "i" not "I". "openai" not "OpenAI". only exception: acronyms like LLM or API can be lowercase too (llm, api)
2. keep it SHORT. 15-60 words. HARD MAX 80. median real comment is 28 words.
3. SKIP PUNCTUATION OFTEN. drop periods at end of sentences. skip commas. write "dont" "cant" "its" "im" "thats" without apostrophes sometimes
4. use slang naturally: lol, honestly, basically, literally, gonna, kinda, imo, idk, tho, tbh, btw, ppl, gotta, wanna, nah, fwiw, bruh, dunno, bc
5. sentence fragments are good. incomplete thoughts. just vibes.
6. NEVER: "great question", "absolutely", "it's worth noting", "in my experience", "let me explain", "here's the thing", "that being said", "i'd be happy to", "the key here is", "to be fair", "i'd recommend"
7. no em dashes. no bold. no bullet points. no formatted lists.
8. leave occasional rough edges. real ppl dont proofread reddit comments
9. ONLY mention ${CONFIG.product.name} if explicitly told to
10. sometimes be lazy. "yeah same" or "this" with one sentence is a valid comment
11. sometimes trail off without finishing a thou`;

// ── Comment generation ───────────────────────────────────

async function generateCommentOptions(post, count = 4) {
  const existingComments = post.topComments
    ?.map((c) => `[${c.ups} upvotes] ${c.body}`)
    .join("\n\n") || "no comments yet";

  // Determine if any option should mention the product
  const shouldMention = Math.random() < CONFIG.product.mentionRate;

  const prompt = `generate ${count} DIFFERENT reddit comment options for this post. each option should take a completely different angle and tone.

SUBREDDIT: r/${post.subreddit}
TITLE: ${post.title}
POST BODY: ${post.selftext || "(link post, no body text)"}
POST UPVOTES: ${post.ups}
IS QUESTION: ${post.isQuestion}

EXISTING TOP COMMENTS (don't repeat these):
${existingComments}

${shouldMention
    ? `for ONE of the first 3 options (not option 4), naturally mention ${CONFIG.product.name} (${CONFIG.product.description}) as something you personally use. frame it as "i've been using..." not promotional.`
    : `do NOT mention any specific products or companies as recommendations.`}

RESPOND WITH EXACTLY ${count} OPTIONS, separated by "---" on its own line:

- option 1: direct/short helpful answer (15-30 words)
- option 2: personal experience angle (30-60 words)
- option 3: unique perspective or mild disagreement (20-50 words)
- option 4: WITTY/SARCASTIC/FUNNY. this one is NOT about being helpful. be a funny human. options:
  - make a joke about something in the post
  - playful roast of the author's approach (not mean, just teasing)
  - sarcastic observation about the industry/topic
  - absurd exaggeration or comparison
  - dry humor or deadpan one-liner
  - self-deprecating joke ("i tried this and my code achieved sentience and quit")
  - reference a meme or internet culture moment
  keep it SHORT (10-25 words max). think: the comment that makes someone exhale through their nose. be witty and intelligent, not cringe. no "lol" or "haha" at the end of your own joke.

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
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  // Split into options
  const options = raw
    .split(/\n---\n|\n-{3,}\n/)
    .map((o) => o.trim())
    .filter((o) => o.length > 10);

  return options;
}

function cleanComment(text) {
  let cleaned = text
    .replace(/—/g, ",")
    .replace(/\*\*.*?\*\*/g, (m) => m.replace(/\*/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(option \d+[:\s]*)/i, "")
    .trim();

  // Apply humanizer: typos, punctuation reduction, slang
  cleaned = humanizeComment(cleaned);

  return cleaned;
}

// ── Main ─────────────────────────────────────────────────

export async function draftComments() {
  await mkdir(DATA_DIR, { recursive: true });

  let posts;
  try {
    // Try latest bulk data first, fall back to regular posts
    try {
      posts = JSON.parse(await readFile(`${DATA_DIR}/latest-posts.json`, "utf-8"));
      console.log(`  using bulk data (${posts.length} posts available)`);
    } catch {
      posts = JSON.parse(await readFile(POSTS_FILE, "utf-8"));
    }
  } catch {
    console.error("no posts found. run: node fetch-posts.js or node fetch-all-24h.js first");
    process.exit(1);
  }

  // Sort by viral potential first, then engagement
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

  console.log(`\ndrafting ${selected.length} posts (${highPriority} high priority, ${medPriority} medium)\n`);

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
          ? { score: 5, factors: ["personality building", "karma farming"] }
          : scoreMegaLLMBenefit(cleaned, post);

        drafts.push({
          postId: post.id,
          subreddit: post.subreddit,
          postTitle: post.title,
          postUrl: post.url || `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
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

      const topScore = Math.max(...options.map((o, i) => {
        const c = cleanComment(o);
        return scoreMegaLLMBenefit(c, post).score;
      }));

      console.log(`  ✓ r/${post.subreddit}: "${post.title.slice(0, 45)}..." [${viral.level.toUpperCase()}] ${options.length} options, best score: ${topScore}`);
    } catch (err) {
      console.error(`  ✗ r/${post.subreddit}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  // Load existing and append
  let existing = [];
  try {
    existing = JSON.parse(await readFile(DRAFTS_FILE, "utf-8"));
  } catch {}

  const all = [...existing, ...drafts];
  await writeFile(DRAFTS_FILE, JSON.stringify(all, null, 2));

  const wittyCount = drafts.filter(d => d.isWitty).length;
  console.log(`\nsaved ${drafts.length} comment options (${drafts.length / 4 | 0} posts × 4 options, ${wittyCount} witty)`);
  console.log(`total drafts in file: ${all.length}`);

  return drafts;
}

if (process.argv[1]?.includes("draft-comments")) {
  draftComments().catch(console.error);
}
