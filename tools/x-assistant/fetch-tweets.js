// ─────────────────────────────────────────────────────────────
// Fetch tweets from X Scraper API
// Uses X Scraper API endpoints to search and fetch tweets
// ─────────────────────────────────────────────────────────────

import "./load-env.js"; // Load .env before importing config
import { CONFIG, validateXScraperApi } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, TWEETS_FILE } from "./paths.js";

async function searchTweets(query, maxResults = 100) {
  const url = new URL(`${CONFIG.xScraperApiUrl}/api/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", Math.min(maxResults, 100));

  try {
    const headers = {
      "User-Agent": "XAssistant/1.0",
    };
    // Add auth header only if API key is configured
    if (CONFIG.xScraperApiKey) {
      headers.Authorization = `Bearer ${CONFIG.xScraperApiKey}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(`X Scraper API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const tweets = data.tweets || [];

    return tweets
      .filter((tweet) => {
        const likes = tweet.likes || tweet.stats?.likes || 0;
        const replies = tweet.stats?.replies || 0;
        if (likes < CONFIG.tweets.minLikes) return false;
        if (replies < CONFIG.tweets.minReplies) return false;
        return true;
      })
      .map((tweet) => {
        return {
          id: tweet.id,
          text: tweet.content || "",
          authorId: tweet.username || "",
          authorUsername: tweet.username || "unknown",
          authorVerified: tweet.verified || false,
          createdAt: tweet.timestamp || new Date().toISOString(),
          likes: tweet.likes || tweet.stats?.likes || 0,
          replies: tweet.stats?.replies || 0,
          retweets: tweet.retweets || 0,
          conversationId: tweet.id,
          url: tweet.url || tweet.link || `https://x.com/${tweet.username}/status/${tweet.id}`,
          topReplies: [], // Populated by fetchReplies
        };
      });
  } catch (err) {
    console.error(`Error searching tweets for "${query}":`, err.message);
    console.error(`Full error:`, err);
    return [];
  }
}

async function fetchReplies(tweetId, maxDepth = 2) {
  const url = new URL(`${CONFIG.xScraperApiUrl}/api/status/${tweetId}`);

  try {
    const headers = {
      "User-Agent": "XAssistant/1.0",
    };
    // Add auth header only if API key is configured
    if (CONFIG.xScraperApiKey) {
      headers.Authorization = `Bearer ${CONFIG.xScraperApiKey}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) return [];

    const data = await response.json();
    const replies = data.replies || data.in_reply_to || [];

    return replies
      .filter((t) => (t.like_count || t.likes || 0) > 0)
      .slice(0, 6)
      .map((t) => {
        return {
          text: (t.text || t.full_text || "").slice(0, 500),
          author: t.username || t.screen_name || "unknown",
          likes: t.like_count || t.likes || 0,
        };
      });
  } catch {
    return [];
  }
}

export async function fetchAllTweets() {
  validateXScraperApi();
  await mkdir(DATA_DIR, { recursive: true });

  console.log(`\nFetching tweets from X (${CONFIG.tweets.searchQueries.length} smart queries)...\n`);
  console.log(`📊 Orchestration Profile:`);
  console.log(`   • Quality Filter: min_faves:${CONFIG.tweets.minLikes}`);
  console.log(`   • Expected Result: 50-70 high-quality tweets`);
  console.log(`   • Fetching Comments: Yes\n`);

  const allTweets = [];

  for (let i = 0; i < CONFIG.tweets.searchQueries.length; i++) {
    const query = CONFIG.tweets.searchQueries[i];
    console.log(`  [${i + 1}/${CONFIG.tweets.searchQueries.length}] Searching: "${query}"`);
    const tweets = await searchTweets(query, CONFIG.tweets.maxResults);

    // Fetch replies/comments for each tweet
    for (const tweet of tweets) {
      console.log(`    • ${tweet.authorUsername}: ${tweet.text.slice(0, 60)}... (${tweet.likes}❤ ${tweet.replies}💬)`);
      tweet.topReplies = await fetchReplies(tweet.id);
      // Rate limit between reply fetches
      await new Promise((r) => setTimeout(r, 500));
    }

    if (tweets.length === 0) {
      console.log(`    (0 tweets - API may be rate-limited or no matches)`);
    }

    allTweets.push(...tweets);
    
    // Minimal delay between queries for fast testing
    if (i < CONFIG.tweets.searchQueries.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Sort by likes (descending)
  allTweets.sort((a, b) => b.likes - a.likes);

  await writeFile(TWEETS_FILE, JSON.stringify(allTweets, null, 2));
  console.log(`\n✅ Orchestration Complete`);
  console.log(`   Saved ${allTweets.length} high-quality tweets with comments`);
  console.log(`   File: ${TWEETS_FILE}\n`);
  return allTweets;
}

// Run directly
if (process.argv[1]?.includes("fetch-tweets")) {
  fetchAllTweets().catch(console.error);
}
