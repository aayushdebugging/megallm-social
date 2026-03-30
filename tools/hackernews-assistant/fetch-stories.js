// ─────────────────────────────────────────────────────────────
// Fetch stories from Hacker News (Firebase API — no auth)
// https://github.com/HackerNews/API
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, POSTS_FILE } from "./paths.js";

const HN = "https://hacker-news.firebaseio.com/v0";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyStory(title) {
  const t = (title || "").trim();
  if (/^Ask HN\b/i.test(t)) return "ask";
  if (/^Show HN\b/i.test(t)) return "show";
  if (/^Tell HN\b/i.test(t)) return "tell";
  return "story";
}

async function fetchJson(path) {
  const res = await fetch(`${HN}${path}`);
  if (!res.ok) throw new Error(`HN ${path}: HTTP ${res.status}`);
  return res.json();
}

async function fetchTopComments(storyId, limit) {
  const story = await fetchJson(`/item/${storyId}.json`);
  await delay(CONFIG.hn.requestDelayMs);
  const kids = Array.isArray(story?.kids) ? story.kids : [];
  const out = [];
  for (const kidId of kids) {
    if (out.length >= limit) break;
    const item = await fetchJson(`/item/${kidId}.json`);
    await delay(CONFIG.hn.requestDelayMs);
    if (item?.type === "comment" && item.text) {
      out.push({
        body: stripHtml(item.text).slice(0, 450),
        ups: 0,
        author: item.by || "?",
      });
    }
  }
  return out;
}

export async function fetchAllStories() {
  await mkdir(DATA_DIR, { recursive: true });

  const { list, idFetchLimit, minScore, maxComments, maxStories, topLevelCommentSample } =
    CONFIG.hn;
  const listName = ["top", "new", "best"].includes(list) ? list : "top";

  console.log(`\nFetching HN /${listName}stories (up to ${idFetchLimit} ids)...\n`);

  const ids = await fetchJson(`/${listName}stories.json`);
  await delay(CONFIG.hn.requestDelayMs);
  if (!Array.isArray(ids)) {
    throw new Error("HN returned invalid story id list");
  }

  const slice = ids.slice(0, idFetchLimit);
  const posts = [];

  for (const id of slice) {
    if (posts.length >= maxStories) break;
    try {
      const item = await fetchJson(`/item/${id}.json`);
      await delay(CONFIG.hn.requestDelayMs);
      if (!item || item.type !== "story" || !item.title) continue;
      const score = item.score ?? 0;
      const descendants = item.descendants ?? 0;
      if (score < minScore) continue;
      if (descendants > maxComments) continue;

      const primaryTag = classifyStory(item.title);
      const url =
        item.url && String(item.url).trim()
          ? item.url
          : `https://news.ycombinator.com/item?id=${id}`;

      const post = {
        id: String(id),
        primaryTag,
        title: item.title,
        description: "",
        url,
        ups: score,
        numComments: descendants,
        createdUtc: item.time ?? Math.floor(Date.now() / 1000),
        isQuestion:
          primaryTag === "ask" ||
          /\?(\s|$)/.test(item.title) ||
          /^Ask HN/i.test(item.title),
        by: item.by || "?",
      };

      post.topComments = await fetchTopComments(id, topLevelCommentSample);
      posts.push(post);
      console.log(`  ✓ ${post.primaryTag} ${score}pts ${descendants}cmt: "${post.title.slice(0, 52)}..."`);
    } catch (err) {
      console.error(`  ✗ item ${id}: ${err.message}`);
    }
  }

  await writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
  console.log(`\nSaved ${posts.length} stories to ${POSTS_FILE}`);
  return posts;
}

if (process.argv[1]?.includes("fetch-stories")) {
  fetchAllStories().catch(console.error);
}
