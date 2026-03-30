import type { PostQueueItem } from "@/lib/pipeline/types";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Blog publishing: write MDX to content directory
// The Next.js app reads from this directory at build/request time
const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

export async function publishBlogPost(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  await mkdir(BLOG_DIR, { recursive: true });

  // Extract slug from title or content
  const slug = (item.title ?? "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

  // If blobPath exists, content was already generated there — copy it
  // Otherwise use the content field directly
  await writeFile(filePath, item.content, "utf-8");

  console.log(`Blog post published: ${filePath}`);

  return {
    url: `https://megallm.io/blog/${slug}`,
    id: slug,
  };
}
