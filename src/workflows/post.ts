import { setState, logPipelineRun } from "@/lib/pipeline/state";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (Date.now() - start >= ms) resolve();
      else queueMicrotask(check);
    };
    check();
  });
}
import { getList } from "@/lib/pipeline/state";
import type { PostQueueItem } from "@/lib/pipeline/types";
import { postToTwitter } from "@/scripts/posters/x-twitter";
import { postToLinkedIn } from "@/scripts/posters/linkedin";
import { postToReddit } from "@/scripts/posters/reddit";
import { postToDevTo } from "@/scripts/posters/devto";
import { postToHackerNews } from "@/scripts/posters/hackernews";
import { postToHashnode } from "@/scripts/posters/hashnode";
import { postToMedium } from "@/scripts/posters/medium";
import { postToTelegraph } from "@/scripts/posters/telegraph";
import { publishBlogPost } from "@/scripts/posters/blog";

type Poster = (item: PostQueueItem) => Promise<{ url: string; id: string }>;

const posters: Record<string, Poster> = {
  "x-twitter": postToTwitter,
  linkedin: postToLinkedIn,
  reddit: postToReddit,
  devto: postToDevTo,
  hackernews: postToHackerNews,
  hashnode: postToHashnode,
  medium: postToMedium,
  telegraph: postToTelegraph,
  blog: publishBlogPost,
};

export async function runPost(): Promise<{
  posted: number;
  failed: number;
}> {
  const startedAt = new Date().toISOString();
  let posted = 0;
  let failed = 0;

  try {
    const postQueue = await getList<PostQueueItem>("post_queue");
    const pending = postQueue.filter(
      (item) =>
        item.status === "pending" &&
        new Date(item.scheduledTime) <= new Date()
    );

    if (pending.length === 0) {
      await logPipelineRun({
        stage: "post",
        startedAt,
        completedAt: new Date().toISOString(),
        status: "completed",
        summary: "No pending posts to publish",
      });
      return { posted: 0, failed: 0 };
    }

    for (const item of pending) {
      const poster = posters[item.platform];
      if (!poster) {
        console.error(`No poster for platform: ${item.platform}`);
        item.status = "failed";
        item.error = `No poster configured for ${item.platform}`;
        failed++;
        continue;
      }

      item.status = "posting";
      await setState("post_queue", postQueue);

      try {
        const result = await poster(item);
        item.status = "posted";
        item.postedUrl = result.url;
        item.postedId = result.id;
        item.postedAt = new Date().toISOString();
        posted++;

        console.log(`Posted to ${item.platform}: ${result.url}`);
      } catch (error) {
        console.error(`Failed to post to ${item.platform}:`, error);
        item.status = "failed";
        item.error = String(error);
        failed++;
      }

      await setState("post_queue", postQueue);

      // Rate limit: wait between posts to avoid triggering platform limits
      if (item.platform !== "blog") {
        await delay(5000);
      }
    }

    await setState("last_post", {
      timestamp: new Date().toISOString(),
      posted,
      failed,
    });

    await logPipelineRun({
      stage: "post",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      summary: `Posted ${posted} items, ${failed} failed`,
    });

    return { posted, failed };
  } catch (error) {
    await logPipelineRun({
      stage: "post",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: "Post workflow failed",
      error: String(error),
    });
    throw error;
  }
}
