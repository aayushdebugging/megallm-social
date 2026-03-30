import { generateText } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/provider";
import { scrapeMultiple, searchWeb } from "@/lib/integrations/firecrawl";
import { getTopQueries, getRisingQueries } from "@/lib/integrations/gsc";
import { searchGoogle, checkRanking, getRelatedKeywords } from "@/lib/integrations/serper";
import { competitors } from "@/data/competitors";
import { models as llmModels } from "@/data/models";
import {
  getContentQueue,
  getStrategyState,
  setState,
  logPipelineRun,
} from "@/lib/pipeline/state";
import { TREND_ANALYSIS_PROMPT } from "@/lib/pipeline/prompts";
import type { ContentQueueItem, TrendAnalysis } from "@/lib/pipeline/types";

export async function runAnalyze(): Promise<TrendAnalysis> {
  const startedAt = new Date().toISOString();

  try {
    // Step 1: Scrape competitor content
    const competitorUrls = competitors
      .flatMap((c) => [c.blogUrl, c.changelogUrl])
      .filter((u): u is string => u !== null);

    const competitorContent = await scrapeMultiple(competitorUrls);

    // Step 2: Search for trending topics
    const strategy = await getStrategyState();
    const searchQueries = [
      "best LLM API 2026",
      "LLM gateway comparison",
      "AI model comparison",
      "new AI model release",
      "cheapest AI API",
      ...strategy.hotTopics.slice(0, 3),
    ];

    const searchResults = await Promise.all(
      searchQueries.map((q) => searchGoogle(q, 5))
    );

    // Step 3: Check for new model announcements
    const providerNewsUrls = [
      "https://openai.com/blog",
      "https://www.anthropic.com/news",
      "https://blog.google/technology/ai",
      "https://mistral.ai/news",
    ];
    const modelNews = await scrapeMultiple(providerNewsUrls);

    // Step 4: Get search performance data
    // Try GSC first, fall back to Serper.dev for ranking checks
    let gscQueries: Awaited<ReturnType<typeof getTopQueries>> = [];
    let risingQueries: Awaited<ReturnType<typeof getRisingQueries>> = [];
    let serperRankings: { query: string; position: number | null; relatedKeywords: string[] }[] = [];

    try {
      gscQueries = await getTopQueries(7);
      risingQueries = await getRisingQueries(28);
      console.log(`GSC: ${gscQueries.length} queries, ${risingQueries.length} rising`);
    } catch {
      console.log("GSC not configured — falling back to Serper.dev");

      // Use Serper to check rankings for our target keywords
      const targetKeywords = [
        "llm gateway", "llm api pricing", "openrouter alternative",
        "cheapest llm api", "unified llm api", "llm router",
        "ai gateway", "llm proxy", "llm cost optimization",
        ...strategy.hotTopics.slice(0, 5),
      ];

      const uniqueKeywords = [...new Set(targetKeywords)].slice(0, 8);
      // Sequential to avoid Serper rate limits
      for (const query of uniqueKeywords) {
        try {
          const ranking = await checkRanking(query);
          const related = await getRelatedKeywords(query);
          serperRankings.push({ query, position: ranking?.position ?? null, relatedKeywords: related });
        } catch (err) {
          console.log(`Serper rate limited on "${query}" — skipping remaining`);
          break;
        }
      }

      console.log(`Serper: checked ${serperRankings.length} keywords`);
    }

    // Step 5: AI synthesizes everything into actionable trends
    const existingQueue = await getContentQueue();
    const existingModelSlugs = llmModels.map((m) => m.slug);

    const { text } = await generateText({
      model: models.analysis,
      system: TREND_ANALYSIS_PROMPT,
      prompt: `
## Competitor Content Scraped
${competitorContent.map((c) => `### ${c.url}\n${c.content.slice(0, 2000)}`).join("\n\n")}

## Search Trend Results
${searchResults.map((r, i) => `### Query: ${searchQueries[i]}\n${r.organic.slice(0, 5).map((o) => `- ${o.title} (${o.link})`).join("\n")}`).join("\n\n")}

## Model News
${modelNews.map((n) => `### ${n.url}\n${n.content.slice(0, 1500)}`).join("\n\n")}

## GSC Rising Queries (high impressions, low CTR — content opportunities)
${risingQueries.map((q) => `- "${q.query}" — ${q.impressions} impressions, ${(q.ctr * 100).toFixed(1)}% CTR, position ${q.position.toFixed(0)}`).join("\n") || "No GSC data yet"}

## Serper Ranking Checks (current positions for target keywords)
${serperRankings.map((r) => `- "${r.query}" — ${r.position ? `ranking #${r.position}` : "not ranking"} | Related: ${r.relatedKeywords.slice(0, 3).join(", ")}`).join("\n") || "N/A (using GSC instead)"}

## Current Strategy Hot Topics
${strategy.hotTopics.join(", ")}

## Already In Queue
${existingQueue.map((q) => q.topic).join(", ") || "empty"}

## Known Model Slugs
${existingModelSlugs.join(", ")}

Analyze all of this and output a JSON object with your trend analysis. Focus on:
1. Topics trending RIGHT NOW that MegaLLM should write about
2. New models not in our data yet
3. Content gaps where we have search impressions but no content
4. Competitor content moves we should respond to
5. Specific content items to add to the queue (prioritized P0/P1/P2)

Return valid JSON matching TrendAnalysis type.`,
    });

    let analysis: TrendAnalysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch?.[0] ?? "{}");
    } catch {
      console.error("Failed to parse AI analysis output");
      analysis = {
        trendingTopics: [],
        newModelsDetected: [],
        contentGaps: [],
        competitorMoves: [],
        recommendedQueue: [],
      };
    }

    // Merge recommended items into the content queue
    const newItems: ContentQueueItem[] = analysis.recommendedQueue.map(
      (item, i) => ({
        ...item,
        id: `analyze-${Date.now()}-${i}`,
        createdAt: new Date().toISOString(),
        status: "pending" as const,
        // Ensure type is set (default to "blog" if not provided by AI)
        type: (item as any).type || "blog",
        // Extract keywords from title if not provided
        targetKeywords: (item as any).targetKeywords || [
          ...new Set(
            String((item as any).topic ?? "")
              .toLowerCase()
              .split(/[:\s,/&\-]+/)
              .filter((w) => w.length > 3 && !["with", "from", "that", "this", "which"].includes(w))
              .slice(0, 8)
          ),
        ],
      })
    );

    const updatedQueue = [...existingQueue, ...newItems];
    await setState("content_queue", updatedQueue);
    await setState("last_analyze", {
      timestamp: new Date().toISOString(),
      trendingTopics: analysis.trendingTopics.length,
      newModels: analysis.newModelsDetected.length,
      contentGaps: analysis.contentGaps.length,
      newQueueItems: newItems.length,
    });

    await logPipelineRun({
      stage: "analyze",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      summary: `Found ${analysis.trendingTopics.length} trends, ${analysis.newModelsDetected.length} new models, queued ${newItems.length} content items`,
    });

    return analysis;
  } catch (error) {
    await logPipelineRun({
      stage: "analyze",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: "Analyze workflow failed",
      error: String(error),
    });
    throw error;
  }
}
