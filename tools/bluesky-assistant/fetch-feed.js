// ─────────────────────────────────────────────────────────────
// Fetch posts from a Bluesky feed (public AppView — no auth)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, POSTS_FILE } from "./paths.js";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function postWebUrl(handle, rkey) {
  const h = String(handle || "").replace(/^@/, "");
  return `https://bsky.app/profile/${encodeURIComponent(h)}/post/${rkey}`;
}

function rkeyFromUri(uri) {
  if (!uri || typeof uri !== "string") return "";
  const i = uri.lastIndexOf("/");
  return i >= 0 ? uri.slice(i + 1) : uri;
}

async function xrpcGet(path, params) {
  const base = CONFIG.bsky.publicApi;
  const url = new URL(`${base}/xrpc/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${path}: HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

function collectThreadReplies(node, depth, max, out) {
  if (!node || out.length >= max) return;
  const replies = node.replies;
  if (!Array.isArray(replies)) return;
  for (const r of replies) {
    if (out.length >= max) break;
    const p = r?.post;
    const text = p?.record?.text;
    if (typeof text === "string" && text.trim()) {
      out.push({
        body: text.trim().slice(0, 420),
        ups: p.likeCount ?? 0,
        author: p.author?.handle ?? "?",
      });
    }
    if (depth < CONFIG.bsky.threadDepth) {
      collectThreadReplies(r, depth + 1, max, out);
    }
  }
}

async function sampleReplies(postUri) {
  const { threadDepth, replySample, requestDelayMs } = CONFIG.bsky;
  try {
    await delay(requestDelayMs);
    const data = await xrpcGet("app.bsky.feed.getPostThread", {
      uri: postUri,
      depth: String(Math.max(1, threadDepth)),
    });
    const root = data?.thread;
    const out = [];
    collectThreadReplies(root, 0, replySample, out);
    return out;
  } catch {
    return [];
  }
}

export async function fetchBlueskyFeed() {
  await mkdir(DATA_DIR, { recursive: true });

  const {
    feedUri,
    feedPages,
    pageLimit,
    minLikes,
    maxReplies,
    maxPosts,
    requestDelayMs,
  } = CONFIG.bsky;

  console.log(`\nFetching Bluesky feed (public API)…\n  ${feedUri}\n`);

  const seen = new Set();
  const candidates = [];
  let cursor;

  for (let page = 0; page < feedPages && candidates.length < maxPosts * 4; page++) {
    await delay(page ? requestDelayMs : 0);
    const params = { feed: feedUri, limit: String(pageLimit) };
    if (cursor) params.cursor = cursor;
    const data = await xrpcGet("app.bsky.feed.getFeed", params);
    const feed = Array.isArray(data.feed) ? data.feed : [];
    cursor = data.cursor;

    for (const item of feed) {
      const view = item?.post;
      if (!view?.uri || !view?.author?.handle) continue;
      const rec = view.record;
      if (!rec || rec.$type !== "app.bsky.feed.post") continue;
      if (rec.reply) continue;

      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      if (!text) continue;

      const likes = view.likeCount ?? 0;
      const replies = view.replyCount ?? 0;
      if (likes < minLikes) continue;
      if (replies > maxReplies) continue;
      if (seen.has(view.uri)) continue;
      seen.add(view.uri);

      const rkey = rkeyFromUri(view.uri);
      const handle = view.author.handle;
      const langs = Array.isArray(rec.langs) ? rec.langs : [];
      const primaryTag = langs[0] || "post";

      candidates.push({
        id: rkey,
        atUri: view.uri,
        primaryTag,
        title: text.length > 320 ? `${text.slice(0, 317)}…` : text,
        description: "",
        url: postWebUrl(handle, rkey),
        ups: likes,
        numComments: replies,
        createdUtc: Math.floor(
          new Date(rec.createdAt || view.indexedAt || Date.now()).getTime() / 1000
        ),
        by: handle,
      });
    }

    if (!cursor) break;
  }

  const posts = candidates.slice(0, maxPosts);

  for (const p of posts) {
    p.topComments = await sampleReplies(p.atUri);
    console.log(
      `  ✓ @${p.by} ${p.ups}♥ ${p.numComments}re: "${p.title.slice(0, 52)}…"`
    );
  }

  await writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
  console.log(`\nSaved ${posts.length} posts to ${POSTS_FILE}\n`);
  return posts;
}

if (process.argv[1]?.includes("fetch-feed")) {
  fetchBlueskyFeed().catch(console.error);
}
