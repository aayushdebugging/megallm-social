import type { PostQueueItem } from "@/lib/pipeline/types";

// Hashnode GraphQL API — free, great SEO, supports custom domains
// Get your token: https://hashnode.com/settings/developer
// Get your publication ID: query { me { publications { edges { node { id } } } } }

const HASHNODE_TOKEN = process.env.HASHNODE_TOKEN ?? "";
const HASHNODE_PUBLICATION_ID = process.env.HASHNODE_PUBLICATION_ID ?? "";
const HASHNODE_API = "https://gql.hashnode.com";

export async function postToHashnode(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  if (!HASHNODE_TOKEN || !HASHNODE_PUBLICATION_ID) {
    throw new Error("HASHNODE_TOKEN and HASHNODE_PUBLICATION_ID must be set");
  }

  const slug = (item.title ?? "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const mutation = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          slug
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      title: item.title ?? "MegaLLM Update",
      contentMarkdown: item.content,
      slug,
      publicationId: HASHNODE_PUBLICATION_ID,
      tags: (item.tags ?? ["ai", "llm"]).map((tag) => ({
        slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: tag,
      })),
      metaTags: {
        title: item.title,
        description: item.content.slice(0, 155),
      },
    },
  };

  const res = await fetch(HASHNODE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: HASHNODE_TOKEN,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Hashnode API error: ${res.status} ${error}`);
  }

  const data = await res.json();

  if (data.errors) {
    throw new Error(`Hashnode GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  const post = data.data?.publishPost?.post;
  return {
    url: post?.url ?? `https://hashnode.com/post/${slug}`,
    id: post?.id ?? `hn-${Date.now()}`,
  };
}
