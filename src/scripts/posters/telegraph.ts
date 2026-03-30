import type { PostQueueItem } from "@/lib/pipeline/types";

// Telegraph (Telegram's instant publishing) — zero auth needed for first post
// Creates an anonymous account, then reuses the token
// Great for instant backlinks and content syndication

const TELEGRAPH_API = "https://api.telegra.ph";
let accessToken = process.env.TELEGRAPH_TOKEN ?? "";

async function ensureAccount(): Promise<string> {
  if (accessToken) return accessToken;

  const res = await fetch(`${TELEGRAPH_API}/createAccount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      short_name: "MegaLLM",
      author_name: "MegaLLM Team",
      author_url: "https://megallm.io",
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegraph account error: ${JSON.stringify(data)}`);

  accessToken = data.result.access_token;
  console.log(`Telegraph token (save to .env.local): TELEGRAPH_TOKEN=${accessToken}`);
  return accessToken;
}

// Convert markdown to Telegraph's Node format (simplified)
function markdownToNodes(md: string): any[] {
  const nodes: any[] = [];
  const lines = md.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      nodes.push({ tag: "h3", children: [trimmed.slice(3)] });
    } else if (trimmed.startsWith("# ")) {
      nodes.push({ tag: "h3", children: [trimmed.slice(2)] });
    } else if (trimmed.startsWith("- ")) {
      nodes.push({ tag: "p", children: [`• ${trimmed.slice(2)}`] });
    } else if (trimmed.startsWith("```")) {
      // Skip code fences
    } else {
      nodes.push({ tag: "p", children: [trimmed] });
    }
  }

  // Add MegaLLM attribution
  nodes.push({ tag: "p", children: ["\n"] });
  nodes.push({
    tag: "p",
    children: [
      "Originally published on ",
      { tag: "a", attrs: { href: "https://megallm.io/blog" }, children: ["MegaLLM Blog"] },
    ],
  });

  return nodes;
}

export async function postToTelegraph(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const token = await ensureAccount();

  const res = await fetch(`${TELEGRAPH_API}/createPage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      title: item.title ?? "MegaLLM Update",
      author_name: "MegaLLM",
      author_url: "https://megallm.io",
      content: markdownToNodes(item.content),
      return_content: false,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegraph error: ${JSON.stringify(data)}`);
  }

  return {
    url: data.result.url,
    id: data.result.path,
  };
}
