// ─────────────────────────────────────────────────────────────
// Analyze top Reddit comments to learn what works
// Fetches 200-300 top comments and extracts patterns
// ─────────────────────────────────────────────────────────────

import { CONFIG } from "./config.js";
import { writeFile, mkdir } from "fs/promises";
import { DATA_DIR } from "./paths.js";
const HEADERS = {
  "User-Agent": "RedditCommentAnalyzer/1.0 (research tool)",
};

async function fetchTopComments(subreddit, sort = "top", timeFilter = "week") {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=10&t=${timeFilter}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children?.map((c) => c.data) ?? [];

    const allComments = [];
    for (const post of posts.slice(0, 8)) {
      const commentsUrl = `https://www.reddit.com/r/${subreddit}/comments/${post.id}.json?limit=15&depth=1&sort=top`;
      try {
        const cRes = await fetch(commentsUrl, { headers: HEADERS });
        if (!cRes.ok) continue;
        const cData = await cRes.json();
        const comments = cData?.[1]?.data?.children ?? [];

        for (const c of comments) {
          if (c.kind !== "t1" || !c.data.body) continue;
          if (c.data.author === "AutoModerator") continue;
          if (c.data.body === "[deleted]" || c.data.body === "[removed]") continue;

          allComments.push({
            subreddit,
            postTitle: post.title,
            body: c.data.body,
            ups: c.data.ups,
            author: c.data.author,
            isOP: c.data.author === post.author,
          });
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch {}
    }

    return allComments;
  } catch (err) {
    console.error(`  ✗ r/${subreddit}: ${err.message}`);
    return [];
  }
}

function analyzeComment(comment) {
  const body = comment.body;
  const words = body.split(/\s+/).filter(Boolean);
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim());

  // Case analysis
  const hasUpperStart = /^[A-Z]/.test(body);
  const isAllLower = body === body.toLowerCase();
  const isMixedCase = !isAllLower && !body.match(/^[A-Z][^.]*$/);
  const lowercaseRatio = (body.match(/[a-z]/g) || []).length / Math.max((body.match(/[a-zA-Z]/g) || []).length, 1);

  // Emoji analysis
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojis = body.match(emojiRegex) || [];

  // Formatting
  const hasCodeBlock = body.includes("```") || body.includes("    ");
  const hasInlineCode = /`[^`]+`/.test(body);
  const hasBullets = body.includes("- ") || body.includes("* ") || /^\d+\./m.test(body);
  const hasLinks = /\[.*?\]\(.*?\)|https?:\/\//.test(body);
  const hasBold = /\*\*.*?\*\*/.test(body);

  // Tone indicators
  const hasQuestion = body.includes("?");
  const hasExclamation = body.includes("!");
  const hasSarcasm = /\/s|lol|lmao|bruh|imagine|sure buddy|copium|least|most.*ever/i.test(body);
  const hasHumor = /lol|lmao|haha|😂|🤣|rofl|💀|bruh/i.test(body);
  const hasAgreement = /this\.|exactly|this is the way|based|real|facts|fr fr|W take/i.test(body);
  const hasDisagreement = /nah|disagree|actually|well.*actually|counterpoint|hot take/i.test(body);
  const isPersonal = /\bI\b.*\b(use|tried|found|think|built|switched|recommend|prefer|run|have)\b/i.test(body);

  // Opener style
  const firstWord = words[0]?.toLowerCase() || "";
  const startsWithI = firstWord === "i" || firstWord === "i've" || firstWord === "i'm";
  const startsWithQuestion = hasQuestion && sentences[0]?.includes("?");
  const startsWithDirectAnswer = /^(yes|no|nah|yep|yea|nope|honestly|tbh|imo|fwiw)/i.test(body);

  // AI-sounding patterns (what to avoid)
  const aiPatterns = [
    /great question/i, /absolutely/i, /it's worth noting/i,
    /I'd be happy to/i, /let me explain/i, /here's the thing/i,
    /in my experience/i, /that being said/i,
  ];
  const hasAIPatterns = aiPatterns.some((p) => p.test(body));

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: Math.round(words.length / Math.max(sentences.length, 1)),
    lowercaseRatio: Math.round(lowercaseRatio * 100),
    isAllLower,
    hasUpperStart,
    emojiCount: emojis.length,
    emojisUsed: [...new Set(emojis)],
    hasCodeBlock,
    hasInlineCode,
    hasBullets,
    hasLinks,
    hasBold,
    hasQuestion,
    hasExclamation,
    hasSarcasm,
    hasHumor,
    hasAgreement,
    hasDisagreement,
    isPersonal,
    startsWithI,
    startsWithQuestion,
    startsWithDirectAnswer,
    hasAIPatterns,
    ups: comment.ups,
    subreddit: comment.subreddit,
  };
}

function aggregateAnalysis(analyses) {
  const total = analyses.length;
  const pct = (count) => Math.round((count / total) * 100);
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  // Split by upvote tiers
  const topComments = analyses.filter((a) => a.ups >= 20);
  const midComments = analyses.filter((a) => a.ups >= 5 && a.ups < 20);

  return {
    totalAnalyzed: total,

    // Length
    avgWordCount: avg(analyses.map((a) => a.wordCount)),
    medianWordCount: analyses.map((a) => a.wordCount).sort((a, b) => a - b)[Math.floor(total / 2)],
    avgWordCountTopComments: topComments.length ? avg(topComments.map((a) => a.wordCount)) : 0,
    wordCountDistribution: {
      "1-30": pct(analyses.filter((a) => a.wordCount <= 30).length),
      "31-80": pct(analyses.filter((a) => a.wordCount > 30 && a.wordCount <= 80).length),
      "81-150": pct(analyses.filter((a) => a.wordCount > 80 && a.wordCount <= 150).length),
      "151-300": pct(analyses.filter((a) => a.wordCount > 150 && a.wordCount <= 300).length),
      "300+": pct(analyses.filter((a) => a.wordCount > 300).length),
    },

    // Case
    pctAllLowercase: pct(analyses.filter((a) => a.isAllLower).length),
    pctStartsUppercase: pct(analyses.filter((a) => a.hasUpperStart).length),
    avgLowercaseRatio: avg(analyses.map((a) => a.lowercaseRatio)),

    // Emojis
    pctHasEmoji: pct(analyses.filter((a) => a.emojiCount > 0).length),
    avgEmojiCount: (analyses.reduce((s, a) => s + a.emojiCount, 0) / total).toFixed(1),
    topEmojis: Object.entries(
      analyses.flatMap((a) => a.emojisUsed).reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 10),

    // Formatting
    pctHasCode: pct(analyses.filter((a) => a.hasCodeBlock || a.hasInlineCode).length),
    pctHasBullets: pct(analyses.filter((a) => a.hasBullets).length),
    pctHasLinks: pct(analyses.filter((a) => a.hasLinks).length),
    pctHasBold: pct(analyses.filter((a) => a.hasBold).length),

    // Tone
    pctHasSarcasm: pct(analyses.filter((a) => a.hasSarcasm).length),
    pctHasHumor: pct(analyses.filter((a) => a.hasHumor).length),
    pctIsPersonal: pct(analyses.filter((a) => a.isPersonal).length),
    pctHasQuestion: pct(analyses.filter((a) => a.hasQuestion).length),
    pctHasExclamation: pct(analyses.filter((a) => a.hasExclamation).length),
    pctHasAgreement: pct(analyses.filter((a) => a.hasAgreement).length),
    pctHasDisagreement: pct(analyses.filter((a) => a.hasDisagreement).length),

    // Openers
    pctStartsWithI: pct(analyses.filter((a) => a.startsWithI).length),
    pctStartsWithDirectAnswer: pct(analyses.filter((a) => a.startsWithDirectAnswer).length),
    pctStartsWithQuestion: pct(analyses.filter((a) => a.startsWithQuestion).length),

    // AI patterns
    pctHasAIPatterns: pct(analyses.filter((a) => a.hasAIPatterns).length),

    // Per-subreddit breakdown
    bySubreddit: Object.fromEntries(
      [...new Set(analyses.map((a) => a.subreddit))].map((sub) => {
        const subAnalyses = analyses.filter((a) => a.subreddit === sub);
        return [sub, {
          count: subAnalyses.length,
          avgWords: avg(subAnalyses.map((a) => a.wordCount)),
          pctHumor: pct(subAnalyses.filter((a) => a.hasHumor).length) * total / subAnalyses.length,
          pctSarcasm: pct(subAnalyses.filter((a) => a.hasSarcasm).length) * total / subAnalyses.length,
          pctCode: pct(subAnalyses.filter((a) => a.hasCodeBlock || a.hasInlineCode).length) * total / subAnalyses.length,
          pctPersonal: pct(subAnalyses.filter((a) => a.isPersonal).length) * total / subAnalyses.length,
          avgUpvotes: avg(subAnalyses.map((a) => a.ups)),
        }];
      })
    ),
  };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const allComments = [];
  const subs = CONFIG.subreddits;

  console.log(`\nAnalyzing top comments from ${subs.length} subreddits...\n`);
  console.log("Target: 200-300 comments\n");

  for (const sub of subs) {
    console.log(`Fetching r/${sub}...`);
    const comments = await fetchTopComments(sub, "top", "week");
    allComments.push(...comments);
    console.log(`  ✓ ${comments.length} comments (total: ${allComments.length})`);

    if (allComments.length >= 300) {
      console.log("\nReached 300 comments, stopping fetch.");
      break;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nAnalyzing ${allComments.length} comments...\n`);

  const analyses = allComments.map(analyzeComment);
  const aggregate = aggregateAnalysis(analyses);

  // Save raw data
  await writeFile(`${DATA_DIR}/comment-analysis-raw.json`, JSON.stringify(allComments, null, 2));
  await writeFile(`${DATA_DIR}/comment-analysis-results.json`, JSON.stringify(aggregate, null, 2));

  // Print summary
  console.log("═".repeat(60));
  console.log("REDDIT COMMENT ANALYSIS RESULTS");
  console.log("═".repeat(60));
  console.log(`\nComments analyzed: ${aggregate.totalAnalyzed}`);
  console.log(`\n── LENGTH ──`);
  console.log(`Average: ${aggregate.avgWordCount} words`);
  console.log(`Median: ${aggregate.medianWordCount} words`);
  console.log(`Top comments (20+ upvotes): ${aggregate.avgWordCountTopComments} words`);
  console.log(`Distribution: ${JSON.stringify(aggregate.wordCountDistribution)}`);
  console.log(`\n── CASE & FORMATTING ──`);
  console.log(`All lowercase: ${aggregate.pctAllLowercase}%`);
  console.log(`Starts uppercase: ${aggregate.pctStartsUppercase}%`);
  console.log(`Has code: ${aggregate.pctHasCode}%`);
  console.log(`Has bullets/lists: ${aggregate.pctHasBullets}%`);
  console.log(`Has links: ${aggregate.pctHasLinks}%`);
  console.log(`Has bold: ${aggregate.pctHasBold}%`);
  console.log(`\n── EMOJIS ──`);
  console.log(`Comments with emojis: ${aggregate.pctHasEmoji}%`);
  console.log(`Avg emojis per comment: ${aggregate.avgEmojiCount}`);
  console.log(`Top emojis: ${aggregate.topEmojis.map(([e, c]) => `${e}(${c})`).join(" ")}`);
  console.log(`\n── TONE ──`);
  console.log(`Sarcasm: ${aggregate.pctHasSarcasm}%`);
  console.log(`Humor (lol/lmao/haha): ${aggregate.pctHasHumor}%`);
  console.log(`Personal ("I use/tried..."): ${aggregate.pctIsPersonal}%`);
  console.log(`Has question: ${aggregate.pctHasQuestion}%`);
  console.log(`Has exclamation: ${aggregate.pctHasExclamation}%`);
  console.log(`Agreement signals: ${aggregate.pctHasAgreement}%`);
  console.log(`Disagreement signals: ${aggregate.pctHasDisagreement}%`);
  console.log(`\n── OPENERS ──`);
  console.log(`Starts with "I": ${aggregate.pctStartsWithI}%`);
  console.log(`Starts with direct answer: ${aggregate.pctStartsWithDirectAnswer}%`);
  console.log(`AI-sounding patterns: ${aggregate.pctHasAIPatterns}%`);
  console.log(`\n── PER SUBREDDIT ──`);
  for (const [sub, stats] of Object.entries(aggregate.bySubreddit)) {
    console.log(`  r/${sub}: ${stats.count} comments, avg ${stats.avgWords} words, avg ${stats.avgUpvotes} upvotes`);
  }
  console.log("");

  return aggregate;
}

main().catch(console.error);
