// ─────────────────────────────────────────────────────────────
// Bulk fetch: ALL posts + ALL comments from last 24 hours
// across all tracked subreddits. Stores locally for analysis.
//
// Usage: node fetch-all-24h.js
// Estimated time: ~20-25 minutes (rate limited to 60 req/min)
// ─────────────────────────────────────────────────────────────

import { CONFIG } from "./config.js";
import { writeFile, mkdir } from "fs/promises";
import { DATA_DIR } from "./paths.js";
const HEADERS = {
  "User-Agent": "RedditBulkFetcher/1.0 (research tool)",
};

const TWENTY_FOUR_HOURS_AGO = Math.floor(Date.now() / 1000) - 86400;

let requestCount = 0;
let startTime = Date.now();

async function rateLimitedFetch(url) {
  requestCount++;

  // Show progress every 50 requests
  if (requestCount % 50 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  [${requestCount} requests, ${elapsed}s elapsed]`);
  }

  const res = await fetch(url, { headers: HEADERS });

  // Respect rate limits — if we get 429, wait and retry
  if (res.status === 429) {
    console.log("  ⏳ rate limited, waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return rateLimitedFetch(url);
  }

  // Wait 1.2s between requests (stay under 60/min)
  await new Promise((r) => setTimeout(r, 1200));

  return res;
}

async function fetchSubredditPosts(subreddit) {
  const allPosts = [];
  let after = null;

  // Paginate through "new" sorted posts until we pass 24h mark
  for (let page = 0; page < 10; page++) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100${after ? `&after=${after}` : ""}`;

    try {
      const res = await rateLimitedFetch(url);
      if (!res.ok) {
        console.log(`  ✗ r/${subreddit} page ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const children = data?.data?.children ?? [];
      after = data?.data?.after;

      let hitOldPosts = false;
      for (const child of children) {
        const post = child.data;
        if (post.created_utc < TWENTY_FOUR_HOURS_AGO) {
          hitOldPosts = true;
          break;
        }
        if (post.stickied) continue;

        allPosts.push({
          id: post.id,
          subreddit: post.subreddit,
          title: post.title,
          selftext: post.selftext || "",
          url: `https://reddit.com${post.permalink}`,
          permalink: post.permalink,
          ups: post.ups,
          downs: post.downs,
          score: post.score,
          numComments: post.num_comments,
          createdUtc: post.created_utc,
          createdAt: new Date(post.created_utc * 1000).toISOString(),
          author: post.author,
          flair: post.link_flair_text || null,
          isQuestion:
            post.title.includes("?") ||
            (post.link_flair_text || "").toLowerCase().includes("question"),
          domain: post.domain,
          isSelf: post.is_self,
        });
      }

      if (hitOldPosts || !after) break;
    } catch (err) {
      console.log(`  ✗ r/${subreddit} page ${page}: ${err.message}`);
      break;
    }
  }

  return allPosts;
}

async function fetchPostComments(permalink) {
  const url = `https://www.reddit.com${permalink}.json?limit=500&depth=5&sort=top`;

  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const commentTree = data?.[1]?.data?.children ?? [];

    // Flatten comment tree recursively
    const comments = [];
    function extractComments(children, depth = 0) {
      for (const child of children) {
        if (child.kind !== "t1" || !child.data?.body) continue;
        if (child.data.author === "AutoModerator") continue;
        if (child.data.body === "[deleted]" || child.data.body === "[removed]") continue;

        comments.push({
          id: child.data.id,
          author: child.data.author,
          body: child.data.body,
          ups: child.data.ups,
          score: child.data.score,
          createdUtc: child.data.created_utc,
          createdAt: new Date(child.data.created_utc * 1000).toISOString(),
          depth,
          parentId: child.data.parent_id,
          isOP: false, // will be set later
        });

        // Recurse into replies
        const replies = child.data.replies?.data?.children;
        if (replies) {
          extractComments(replies, depth + 1);
        }
      }
    }

    extractComments(commentTree);
    return comments;
  } catch {
    return [];
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  startTime = Date.now();

  const subs = CONFIG.subreddits;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`BULK FETCH: Last 24 hours across ${subs.length} subreddits`);
  console.log(`${"═".repeat(60)}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Rate limit: ~60 req/min (1.2s between requests)`);
  console.log(`Estimated time: ~20-25 minutes\n`);

  // Phase 1: Fetch all posts
  console.log("── PHASE 1: Fetching posts ──\n");
  const allPosts = [];

  for (const sub of subs) {
    const posts = await fetchSubredditPosts(sub);
    allPosts.push(...posts);
    console.log(`  ✓ r/${sub}: ${posts.length} posts (total: ${allPosts.length})`);
  }

  console.log(`\n  Total posts: ${allPosts.length}`);

  // Phase 2: Fetch comments for each post
  console.log("\n── PHASE 2: Fetching comments ──\n");
  const allComments = [];
  let postIdx = 0;

  for (const post of allPosts) {
    postIdx++;
    if (postIdx % 20 === 0 || postIdx === 1) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const eta = allPosts.length > 0
        ? ((Date.now() - startTime) / postIdx * (allPosts.length - postIdx) / 1000 / 60).toFixed(1)
        : "?";
      console.log(`  Progress: ${postIdx}/${allPosts.length} posts | ${allComments.length} comments | ${elapsed}min elapsed | ~${eta}min remaining`);
    }

    const comments = await fetchPostComments(post.permalink);

    // Mark OP comments
    for (const c of comments) {
      c.isOP = c.author === post.author;
    }

    post.commentsFetched = comments.length;
    allComments.push(...comments);
  }

  // Stats
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const stats = {
    fetchedAt: new Date().toISOString(),
    timeWindow: "24 hours",
    subredditsScanned: subs.length,
    totalPosts: allPosts.length,
    totalComments: allComments.length,
    totalRequests: requestCount,
    elapsedMinutes: parseFloat(elapsed),
    bySubreddit: Object.fromEntries(
      subs.map((sub) => {
        const subPosts = allPosts.filter((p) => p.subreddit === sub);
        const subComments = allComments.filter((c) =>
          subPosts.some((p) => c.parentId?.includes(p.id) || subPosts.some((sp) => sp.permalink.includes(c.id)))
        );
        return [sub, { posts: subPosts.length, comments: subComments.length }];
      })
    ),
  };

  // Save everything
  const dateStamp = new Date().toISOString().split("T")[0];

  await writeFile(
    `${DATA_DIR}/bulk-posts-${dateStamp}.json`,
    JSON.stringify(allPosts, null, 2)
  );
  await writeFile(
    `${DATA_DIR}/bulk-comments-${dateStamp}.json`,
    JSON.stringify(allComments, null, 2)
  );
  await writeFile(
    `${DATA_DIR}/bulk-stats-${dateStamp}.json`,
    JSON.stringify(stats, null, 2)
  );

  // Also save as "latest" for easy access
  await writeFile(`${DATA_DIR}/latest-posts.json`, JSON.stringify(allPosts, null, 2));
  await writeFile(`${DATA_DIR}/latest-comments.json`, JSON.stringify(allComments, null, 2));

  console.log(`\n${"═".repeat(60)}`);
  console.log("FETCH COMPLETE");
  console.log(`${"═".repeat(60)}`);
  console.log(`Time:     ${elapsed} minutes`);
  console.log(`Requests: ${requestCount}`);
  console.log(`Posts:    ${allPosts.length}`);
  console.log(`Comments: ${allComments.length}`);
  console.log(`\nFiles saved:`);
  console.log(`  data/bulk-posts-${dateStamp}.json`);
  console.log(`  data/bulk-comments-${dateStamp}.json`);
  console.log(`  data/bulk-stats-${dateStamp}.json`);
  console.log(`  data/latest-posts.json`);
  console.log(`  data/latest-comments.json`);
}

main().catch(console.error);
