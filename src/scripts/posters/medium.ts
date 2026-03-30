import type { PostQueueItem } from "@/lib/pipeline/types";

// Medium API — free, create-only (no edit/delete via API)
// Get your integration token: https://medium.com/me/settings/security
// Note: Medium API is officially "no longer maintained" but still works

const MEDIUM_TOKEN = process.env.MEDIUM_TOKEN ?? "";
const MEDIUM_API = "https://api.medium.com/v1";

async function getMediumUserId(): Promise<string> {
  const res = await fetch(`${MEDIUM_API}/me`, {
    headers: {
      Authorization: `Bearer ${MEDIUM_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Medium API error fetching user: ${res.status}`);
  }

  const data = await res.json();
  return data.data.id;
}

export async function postToMedium(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  if (!MEDIUM_TOKEN) {
    throw new Error("MEDIUM_TOKEN not set");
  }

  const userId = await getMediumUserId();

  const res = await fetch(`${MEDIUM_API}/users/${userId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MEDIUM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: item.title ?? "MegaLLM Update",
      contentFormat: "markdown",
      content: item.content,
      tags: (item.tags ?? ["ai", "llm", "api"]).slice(0, 5),
      publishStatus: "draft", // "public" to publish immediately
      canonicalUrl: item.blobPath
        ? `https://megallm.io/blog/${(item.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        : undefined,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Medium API error: ${res.status} ${error}`);
  }

  const data = await res.json();
  const post = data.data;

  return {
    url: post?.url ?? "https://medium.com",
    id: post?.id ?? `med-${Date.now()}`,
  };
}
