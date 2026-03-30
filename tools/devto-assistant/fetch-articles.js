// ─────────────────────────────────────────────────────────────
// Fetch top articles from Dev.to for target tags (public API)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, POSTS_FILE } from "./paths.js";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "DevToCommentAssistant/1.0 (educational tool)",
};

function flattenComments(nodes, depth = 0, max = 5, out = []) {
  if (!nodes || !Array.isArray(nodes) || out.length >= max) return out;
  for (const c of nodes) {
    if (out.length >= max) break;
    if (c?.type_of === "comment" && c.body_markdown) {
      out.push({
        body: String(c.body_markdown).slice(0, 500),
        ups: c.public_reactions_count ?? 0,
        author: c.user?.username ?? "?",
      });
    }
    if (c.children?.length && out.length < max) {
      flattenComments(c.children, depth + 1, max, out);
    }
  }
  return out;
}

async function fetchCommentsForArticle(articleId) {
  const url = `https://dev.to/api/comments?a_id=${articleId}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    return flattenComments(list, 0, 5);
  } catch {
    return [];
  }
}

async function fetchTag(tag) {
  const { topDays, minReactions, maxComments, articlesPerTag } = CONFIG.posts;
  const perPage = Math.min(30, articlesPerTag * 2);
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=${topDays}&per_page=${perPage}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.error(`  ✗ #${tag}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const posts = (Array.isArray(data) ? data : [])
      .filter((a) => {
        if (!a?.id) return false;
        const reactions = a.positive_reactions_count ?? 0;
        const cc = a.comments_count ?? 0;
        if (reactions < minReactions) return false;
        if (cc > maxComments) return false;
        return true;
      })
      .slice(0, articlesPerTag)
      .map((a) => {
        const published = a.published_at || a.created_at;
        const ts = published ? Math.floor(new Date(published).getTime() / 1000) : Date.now() / 1000;
        const tagList = Array.isArray(a.tag_list)
          ? a.tag_list
          : typeof a.tag_list === "string"
            ? a.tag_list.split(",").map((t) => t.trim())
            : [];

        return {
          id: String(a.id),
          primaryTag: tag,
          tags: tagList,
          title: a.title || "",
          description: (a.description || "").slice(0, 2000),
          url: a.url || `https://dev.to${a.path || ""}`,
          ups: a.positive_reactions_count ?? 0,
          numComments: a.comments_count ?? 0,
          createdUtc: ts,
          isQuestion:
            String(a.title || "").includes("?") ||
            /\b(how|what|why|when|which|who)\b/i.test(a.title || ""),
        };
      });

    console.log(`  ✓ #${tag}: ${posts.length} articles`);
    return posts;
  } catch (err) {
    console.error(`  ✗ #${tag}: ${err.message}`);
    return [];
  }
}

export async function fetchAllArticles() {
  await mkdir(DATA_DIR, { recursive: true });

  console.log(`\nFetching articles from ${CONFIG.tags.length} tags...\n`);

  const allPosts = [];
  for (const tag of CONFIG.tags) {
    const posts = await fetchTag(tag);
    for (const post of posts) {
      post.topComments = await fetchCommentsForArticle(post.id);
      await new Promise((r) => setTimeout(r, 800));
    }
    allPosts.push(...posts);
    await new Promise((r) => setTimeout(r, 1500));
  }

  allPosts.sort((a, b) => {
    if (a.isQuestion && !b.isQuestion) return -1;
    if (!a.isQuestion && b.isQuestion) return 1;
    return b.ups - a.ups;
  });

  await writeFile(POSTS_FILE, JSON.stringify(allPosts, null, 2));
  console.log(`\nSaved ${allPosts.length} articles to ${POSTS_FILE}`);
  return allPosts;
}

if (process.argv[1]?.includes("fetch-articles")) {
  fetchAllArticles().catch(console.error);
}
