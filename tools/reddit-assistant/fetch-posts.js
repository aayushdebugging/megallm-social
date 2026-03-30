// ─────────────────────────────────────────────────────────────
// Fetch top posts from target subreddits
// Uses Reddit's public JSON API — no auth needed
// ─────────────────────────────────────────────────────────────

import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, POSTS_FILE } from "./paths.js";

const HEADERS = {
  "User-Agent": "RedditCommentAssistant/1.0 (educational tool)",
};

async function fetchSubreddit(subreddit) {
  const { sort, postsPerSubreddit, timeFilter, minUpvotes, maxComments } = CONFIG.posts;
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${postsPerSubreddit * 2}&t=${timeFilter}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.error(`  ✗ r/${subreddit}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const posts = (data?.data?.children ?? [])
      .map((child) => child.data)
      .filter((post) => {
        if (post.stickied) return false;
        if (post.ups < minUpvotes) return false;
        if (post.num_comments > maxComments) return false;
        if (post.locked) return false;
        return true;
      })
      .slice(0, postsPerSubreddit)
      .map((post) => ({
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: (post.selftext || "").slice(0, 2000),
        url: `https://reddit.com${post.permalink}`,
        ups: post.ups,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        flair: post.link_flair_text || null,
        isQuestion:
          post.title.includes("?") ||
          post.link_flair_text?.toLowerCase().includes("question") ||
          post.link_flair_text?.toLowerCase().includes("help"),
      }));

    console.log(`  ✓ r/${subreddit}: ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.error(`  ✗ r/${subreddit}: ${err.message}`);
    return [];
  }
}

async function fetchTopComments(postId, subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=5&depth=1`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const comments = data?.[1]?.data?.children ?? [];
    return comments
      .filter((c) => c.kind === "t1")
      .slice(0, 5)
      .map((c) => ({
        body: (c.data.body || "").slice(0, 500),
        ups: c.data.ups,
        author: c.data.author,
      }));
  } catch {
    return [];
  }
}

export async function fetchAllPosts() {
  await mkdir(DATA_DIR, { recursive: true });

  console.log(`\nFetching posts from ${CONFIG.subreddits.length} subreddits...\n`);

  const allPosts = [];
  for (const sub of CONFIG.subreddits) {
    const posts = await fetchSubreddit(sub);
    // Fetch top comments for context
    for (const post of posts) {
      post.topComments = await fetchTopComments(post.id, post.subreddit);
      // Rate limit: Reddit allows ~60 requests/min for unauthenticated
      await new Promise((r) => setTimeout(r, 1200));
    }
    allPosts.push(...posts);
    // Pause between subreddits
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Sort: prioritize questions and high-engagement posts
  allPosts.sort((a, b) => {
    if (a.isQuestion && !b.isQuestion) return -1;
    if (!a.isQuestion && b.isQuestion) return 1;
    return b.ups - a.ups;
  });

  await writeFile(POSTS_FILE, JSON.stringify(allPosts, null, 2));
  console.log(`\nSaved ${allPosts.length} posts to ${POSTS_FILE}`);
  return allPosts;
}

// Run directly
if (process.argv[1]?.includes("fetch-posts")) {
  fetchAllPosts().catch(console.error);
}
