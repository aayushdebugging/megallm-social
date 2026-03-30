import type { PostQueueItem } from "@/lib/pipeline/types";

// Dev.to has a free API — no Playwright needed
// Load env vars inside function to ensure dotenv/config has been processed
function getDevToConfig() {
  return {
    apiKey: process.env.DEVTO_API_KEY ?? "",
    username: process.env.DEVTO_USERNAME ?? "",
    publishImmediately:
      (process.env.DEVTO_PUBLISH_IMMEDIATELY ?? "true").toLowerCase() === "true",
    defaultTags: process.env.DEVTO_DEFAULT_TAGS ?? "ai,llm,api",
  };
}

function normalizeDevToTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function getDevToTags(item: PostQueueItem): string[] {
  const config = getDevToConfig();
  const defaultTags = config.defaultTags
    .split(",")
    .map(normalizeDevToTag)
    .filter((tag) => tag.length > 0);

  const itemTags = (item.tags ?? [])
    .map(normalizeDevToTag)
    .filter((tag) => tag.length > 0);

  const combined = Array.from(new Set([...defaultTags, ...itemTags])).slice(0, 4);

  return combined.length > 0 ? combined : ["ai", "llm", "api"];
}

export async function postToDevTo(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const config = getDevToConfig();

  if (!config.apiKey) {
    throw new Error("DEVTO_API_KEY not set");
  }

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      article: {
        title: item.title ?? "MegaLLM Update",
        body_markdown: item.content,
        published: config.publishImmediately,
        tags: getDevToTags(item),
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Dev.to API error: ${res.status} ${error}`);
  }

  const data = await res.json();

  const username = getDevToConfig().username;
  return {
    url:
      data.url ??
      (username
        ? `https://dev.to/${username}/${data.slug}`
        : `https://dev.to/${data.slug}`),
    id: String(data.id),
  };
}
