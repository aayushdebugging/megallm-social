import { generateText } from "ai";
import { models } from "@/lib/ai/provider";
import { getList, setState, logPipelineRun, getState } from "@/lib/pipeline/state";
import { getTopQueries, getPagePerformance } from "@/lib/integrations/gsc";
import { getMultipleTweetMetrics } from "@/lib/integrations/twitterapi-io";
import { getPageMetrics } from "@/lib/integrations/analytics";
import { FEEDBACK_ANALYSIS_PROMPT } from "@/lib/pipeline/prompts";
import type {
  PostQueueItem,
  SocialMetrics,
  ContentScore,
} from "@/lib/pipeline/types";

export async function runFeedback(): Promise<{
  metricsCollected: number;
  scoresUpdated: number;
}> {
  const startedAt = new Date().toISOString();
  const dateKey = new Date().toISOString().split("T")[0];

  try {
    // Step 1: Collect GSC performance
    let gscData: Awaited<ReturnType<typeof getTopQueries>> = [];
    let pageData: Awaited<ReturnType<typeof getPagePerformance>> = [];
    try {
      gscData = await getTopQueries(7);
      pageData = await getPagePerformance(7);
    } catch {
      console.log("GSC not configured — skipping search metrics");
    }

    await setState(`feedback:gsc:${dateKey}`, {
      queries: gscData.slice(0, 100),
      pages: pageData.slice(0, 100),
      collectedAt: new Date().toISOString(),
    });

    // Step 2: Collect social engagement for posted items
    const postQueue = await getList<PostQueueItem>("post_queue");
    const postedItems = postQueue.filter((item) => item.status === "posted");

    const socialMetrics: SocialMetrics[] = [];

    // Twitter metrics via TwitterAPI.io
    const twitterPosts = postedItems.filter(
      (item) => item.platform === "x-twitter" && item.postedId
    );
    if (twitterPosts.length > 0) {
      const tweetMetrics = await getMultipleTweetMetrics(
        twitterPosts.map((p) => p.postedId!)
      );
      for (const metric of tweetMetrics) {
        socialMetrics.push({
          platform: "x-twitter",
          postId: metric.tweetId,
          likes: metric.likes,
          shares: metric.retweets,
          comments: metric.replies,
          impressions: metric.impressions,
          clicks: 0, // TwitterAPI.io doesn't expose click data
          collectedAt: new Date().toISOString(),
        });
      }
    }

    await setState(`feedback:social:${dateKey}`, socialMetrics);

    // Step 3: Collect Vercel Analytics page metrics
    const blogPosts = postedItems.filter(
      (item) => item.platform === "blog" && item.postedUrl
    );
    const pagePaths = blogPosts.map(
      (p) => new URL(p.postedUrl!, "https://megallm.io").pathname
    );
    const analyticsData = await getPageMetrics(pagePaths);
    await setState(`feedback:analytics:${dateKey}`, analyticsData);

    // Step 4: Aggregate into content scores
    const existingScores =
      (await getState<Record<string, ContentScore>>("content_scores")) ?? {};

    const { text } = await generateText({
      model: models.analysis,
      system: FEEDBACK_ANALYSIS_PROMPT,
      prompt: `
## GSC Data (top queries)
${gscData.slice(0, 30).map((r) => `- "${r.keys[0]}" — clicks: ${r.clicks}, impressions: ${r.impressions}, CTR: ${(r.ctr * 100).toFixed(1)}%, pos: ${r.position.toFixed(0)}`).join("\n")}

## Page Performance (GSC)
${pageData.slice(0, 20).map((r) => `- ${r.keys[0]} — clicks: ${r.clicks}, impressions: ${r.impressions}`).join("\n")}

## Social Metrics Collected Today
${socialMetrics.map((m) => `- ${m.platform} (${m.postId}): likes=${m.likes}, shares=${m.shares}, comments=${m.comments}, impressions=${m.impressions}`).join("\n") || "No social metrics yet"}

## Analytics Page Views
${analyticsData.map((p) => `- ${p.path}: ${p.pageViews} views, ${p.uniqueVisitors} unique`).join("\n") || "No analytics data yet"}

## Existing Content Scores
${Object.entries(existingScores).map(([slug, score]) => `- ${slug}: ${score.compositeScore.toFixed(1)}`).join("\n") || "No existing scores"}

Analyze the performance data and return a JSON object with updated content scores.
For each piece of content, compute:
  compositeScore = (gscClicks * 3) + (socialEngagement * 2) + (pageViews * 1) + (positionChange * 4)
Apply exponential decay for older content: score * (0.95 ^ daysSincePublished)

Return JSON: { "scores": { "slug": { compositeScore, gscClicks, socialEngagement, pageViews, positionChange, lastUpdated } } }`,
    });

    let updatedScores = existingScores;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
      if (parsed.scores) {
        updatedScores = { ...existingScores, ...parsed.scores };
      }
    } catch {
      console.error("Failed to parse feedback analysis");
    }

    await setState("content_scores", updatedScores);

    await setState(`feedback:aggregated:${dateKey}`, {
      gscQueryCount: gscData.length,
      socialMetricsCount: socialMetrics.length,
      analyticsPageCount: analyticsData.length,
      scoresUpdated: Object.keys(updatedScores).length,
      collectedAt: new Date().toISOString(),
    });

    await logPipelineRun({
      stage: "feedback",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      summary: `Collected ${socialMetrics.length} social metrics, ${gscData.length} GSC queries, updated ${Object.keys(updatedScores).length} scores`,
    });

    return {
      metricsCollected: socialMetrics.length + gscData.length,
      scoresUpdated: Object.keys(updatedScores).length,
    };
  } catch (error) {
    await logPipelineRun({
      stage: "feedback",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: "Feedback workflow failed",
      error: String(error),
    });
    throw error;
  }
}
