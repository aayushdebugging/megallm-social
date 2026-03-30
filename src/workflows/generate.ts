import { generateText } from "ai";
import { models } from "@/lib/ai/provider";
import {
  getContentQueue,
  getStrategyState,
  setState,
  logPipelineRun,
} from "@/lib/pipeline/state";
import {
  BLOG_GENERATION_PROMPT,
  SOCIAL_GENERATION_PROMPT,
  COMPARISON_GENERATION_PROMPT,
} from "@/lib/pipeline/prompts";
import { humanize } from "@/lib/pipeline/humanizer";
import {
  assignDistribution,
  getRewriteInstructions,
  getWordCountTarget,
  PLATFORM_STYLE,
} from "@/lib/pipeline/distribution";
import type {
  ContentQueueItem,
  PostQueueItem,
  Platform,
} from "@/lib/pipeline/types";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const DRAFTS_DIR = path.join(process.cwd(), ".pipeline-drafts");

async function ensureDraftsDir() {
  await mkdir(DRAFTS_DIR, { recursive: true });
  await mkdir(path.join(DRAFTS_DIR, "social"), { recursive: true });
  await mkdir(path.join(DRAFTS_DIR, "blog"), { recursive: true });
}

async function generateBlogPost(
  item: ContentQueueItem,
  strategy: Awaited<ReturnType<typeof getStrategyState>>,
  targetPlatform: Platform = "blog"
): Promise<PostQueueItem[]> {
  const contentType = (item as any).contentType ?? item.type ?? "guide";
  const wordTarget = getWordCountTarget(contentType);
  const platformStyle = PLATFORM_STYLE[targetPlatform];

  const { text } = await generateText({
    model: models.content,
    system: BLOG_GENERATION_PROMPT,
    prompt: `
Topic: ${item.topic}
Target Keywords: ${item.targetKeywords.join(", ")}
Priority: ${item.priority}
Target Platform: ${targetPlatform}
Word Count Target: ${wordTarget.min}-${wordTarget.max} words (STRICT — do not pad beyond ${wordTarget.max})
AIO Passage Target: Each H2 section should be a self-contained ~${wordTarget.aioPassageLength}-word answer
Content Type: ${contentType}
Platform Style: ${platformStyle?.tone ?? "authoritative"}
Unique Angle: ${platformStyle?.uniqueAngle ?? "comprehensive reference"}

Strategy context:
- Tone: ${strategy.toneAdjustments.moreOpinionated ? "opinionated" : "neutral"}, ${strategy.toneAdjustments.moreTechnical ? "technical" : "accessible"}
- Include code examples: ${strategy.toneAdjustments.includeCodeExamples}
- Include comparison tables: ${strategy.toneAdjustments.comparisonTables}

${targetPlatform !== "blog" ? getRewriteInstructions(targetPlatform, item.topic) : ""}

Write a complete MDX blog post with frontmatter. Target ${wordTarget.min}-${wordTarget.max} words.
${wordTarget.notes}
The post should follow AIO optimization: question-format H2s, front-loaded answers (50-70 words), HTML tables, FAQ section at the end.
Include real model names, real pricing, and real code examples using MegaLLM's API.
DO NOT pad content. Every sentence must earn its place.`,
  });

  const humanized = humanize(text);
  const slug = item.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = path.join(DRAFTS_DIR, "blog", `${slug}.mdx`);
  await writeFile(filePath, humanized, "utf-8");

  const posts: PostQueueItem[] = [
    {
      id: `post-${targetPlatform}-${Date.now()}`,
      contentId: item.id,
      platform: targetPlatform,  // Use the actual target platform
      content: humanized,
      title: item.topic,
      blobPath: filePath,
      scheduledTime: new Date().toISOString(),
      status: "pending",
    },
  ];

  return posts;
}

async function generateSocialPosts(
  item: ContentQueueItem,
  strategy: Awaited<ReturnType<typeof getStrategyState>>
): Promise<PostQueueItem[]> {
  const posts: PostQueueItem[] = [];
  const platforms = item.platformTargets.filter((p) => p !== "blog");

  for (const platform of platforms) {
    const prompt = getSocialPrompt(platform, item, strategy);

    const { text } = await generateText({
      model: models.fast,
      system: SOCIAL_GENERATION_PROMPT[platform] ?? SOCIAL_GENERATION_PROMPT["x-twitter"],
      prompt,
    });

    // Clean: AI sometimes returns JSON-wrapped text — extract the actual content
    let cleaned = text;
    try {
      const jsonMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        cleaned = parsed.text ?? parsed.content ?? parsed.post ?? cleaned;
      } else if (cleaned.trim().startsWith("{")) {
        const parsed = JSON.parse(cleaned.trim());
        cleaned = parsed.text ?? parsed.content ?? parsed.post ?? cleaned;
      }
    } catch {
      // Not JSON, use as-is
    }
    cleaned = humanize(cleaned);

    const socialPath = path.join(
      DRAFTS_DIR,
      "social",
      `${platform}-${item.id}.txt`
    );
    await writeFile(socialPath, cleaned, "utf-8");

    posts.push({
      id: `post-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contentId: item.id,
      platform,
      content: cleaned,
      title: platform === "reddit" || platform === "devto" ? item.topic : undefined,
      subreddit:
        platform === "reddit"
          ? strategy.redditTargets[
              Math.floor(Math.random() * strategy.redditTargets.length)
            ]
          : undefined,
      tags:
        platform === "devto"
          ? item.targetKeywords.slice(0, 4)
          : undefined,
      scheduledTime: new Date().toISOString(),
      status: "pending",
    });
  }

  return posts;
}

function getSocialPrompt(
  platform: Platform,
  item: ContentQueueItem,
  strategy: Awaited<ReturnType<typeof getStrategyState>>
): string {
  // Safe fallback for targetKeywords
  const keywords = (item.targetKeywords && item.targetKeywords.length > 0) 
    ? item.targetKeywords 
    : String(item.topic ?? "")
        .toLowerCase()
        .split(/[:\s,/&\-]+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
  
  const base = `Topic: ${item.topic}\nKeywords: ${keywords.join(", ")}`;

  switch (platform) {
    case "x-twitter":
      return `${base}\n\nWrite a tweet (max 280 chars). Hook-first, engaging. No hashtag spam — max 2 hashtags.`;
    case "linkedin":
      return `${base}\n\nWrite a LinkedIn post (max 1300 chars). Professional but not corporate. Problem-solution structure. End with a question to drive comments.`;
    case "reddit":
      return `${base}\n\nWrite a Reddit post body. Authentic tone — not promotional. Lead with value, mention MegaLLM naturally only if relevant. Target subreddit: ${strategy.redditTargets[0]}`;
    case "devto":
      return `${base}\n\nWrite a Dev.to article intro and outline. Developer-friendly tutorial style. Include code examples.`;
    case "hackernews":
      return `${base}\n\nWrite a concise HN submission title (factual, not clickbait) and a brief comment to accompany it.`;
    default:
      return base;
  }
}

export async function runGenerate(): Promise<{
  generated: number;
  queued: number;
}> {
  const startedAt = new Date().toISOString();
  await ensureDraftsDir();

  try {
    const contentQueue = await getContentQueue();
    const strategy = await getStrategyState();

    // Select top items to generate (1-3 per run)
    // Normalize fields: AI may output "title" instead of "topic", "contentType" instead of "type"
    const normalized = contentQueue.map((item: any) => ({
      ...item,
      topic: item.topic ?? item.title ?? "Untitled",
      type: item.type || (
        (item.contentType === "comparison") ? "comparison" :
        (item.contentType === "guide" || item.contentType === "educational" || item.contentType === "tutorial" || item.contentType === "case-study" || item.contentType === "thought-leadership") ? "blog" :
        "blog"  // Default to "blog" instead of "social" to generate full blog posts
      ),
      platformTargets: item.platformTargets ?? ["blog", "x-twitter", "linkedin"],
      targetKeywords: item.targetKeywords || [
        ...new Set(
          String(item.topic ?? item.title ?? "untitled")
            .toLowerCase()
            .split(/[:\s,/&\-]+/)
            .filter((w) => w.length > 3)
            .slice(0, 8)
        ),
      ],
    })) as ContentQueueItem[];

    const pending = normalized
      .filter((item) => item.status === "pending")
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      })
      .slice(0, 3);

    if (pending.length === 0) {
      await logPipelineRun({
        stage: "generate",
        startedAt,
        completedAt: new Date().toISOString(),
        status: "completed",
        summary: "No pending content to generate",
      });
      return { generated: 0, queued: 0 };
    }

    const allPosts: PostQueueItem[] = [];

    for (const item of pending) {
      // Find original item in contentQueue and update status
      const origIdx = contentQueue.findIndex((q: any) => q.id === item.id);
      if (origIdx >= 0) (contentQueue[origIdx] as any).status = "generating";
      await setState("content_queue", contentQueue);

      console.log(`Generating: [${item.type}] ${item.topic}`);

      try {
        // Anti-spam distribution: assign platforms for THIS content item
        const contentType = (item as any).contentType ?? item.type ?? "guide";
        const { blogTargets, socialTargets } = assignDistribution(contentType);

        console.log(`  Blog targets: ${blogTargets.join(", ")}`);
        console.log(`  Social targets: ${socialTargets.join(", ")}`);

        // Generate blog post for each assigned blog platform (unique version per platform)
        if (blogTargets.length > 0) {
          for (const blogPlatform of blogTargets) {
            console.log(`  Writing ${blogPlatform} version...`);
            const blogPosts = await generateBlogPost(item, strategy, blogPlatform);
            console.log(`    ✓ Created ${blogPosts.length} blog posts for ${blogPlatform}`);
            allPosts.push(...blogPosts);
          }
        }

        // Generate social posts ONLY for assigned social platforms (not all)
        const limitedItem = {
          ...item,
          platformTargets: socialTargets,
        };
        const socialPosts = await generateSocialPosts(limitedItem, strategy);
        console.log(`  ✓ Created ${socialPosts.length} social posts`);
        allPosts.push(...socialPosts);

        // Mark as generated
        if (origIdx >= 0) (contentQueue[origIdx] as any).status = "generated";
      } catch (error) {
        console.error(`Failed to generate content for ${item.id}:`, error);
        if (origIdx >= 0) (contentQueue[origIdx] as any).status = "failed";
      }

      await setState("content_queue", contentQueue);
    }

    // Add all generated posts to the post queue
    const { getList } = await import("@/lib/pipeline/state");
    const existingPostQueue = await getList<PostQueueItem>("post_queue");
    console.log(`\n📦 Queue Summary:`);
    console.log(`   Total posts created: ${allPosts.length}`);
    console.log(`   Existing queue size: ${existingPostQueue.length}`);
    console.log(`   New queue size: ${existingPostQueue.length + allPosts.length}`);
    
    if (allPosts.length > 0) {
      allPosts.forEach((p) => console.log(`   • ${p.platform}: ${p.title || p.contentId}`));
    }
    
    await setState("post_queue", [...existingPostQueue, ...allPosts]);

    await setState("last_generate", {
      timestamp: new Date().toISOString(),
      itemsGenerated: pending.length,
      postsQueued: allPosts.length,
    });

    await logPipelineRun({
      stage: "generate",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      summary: `Generated content for ${pending.length} items, queued ${allPosts.length} posts`,
    });

    return { generated: pending.length, queued: allPosts.length };
  } catch (error) {
    await logPipelineRun({
      stage: "generate",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: "Generate workflow failed",
      error: String(error),
    });
    throw error;
  }
}
