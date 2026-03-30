import { generateText } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/provider";
import {
  getState,
  setState,
  getStrategyState,
  setStrategyState,
  logPipelineRun,
} from "@/lib/pipeline/state";
import { STRATEGY_UPDATE_PROMPT } from "@/lib/pipeline/prompts";
import type { StrategyState, ContentScore } from "@/lib/pipeline/types";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function runImprove(): Promise<{
  changesApplied: string[];
  reportPath: string;
}> {
  const startedAt = new Date().toISOString();

  try {
    // Step 1: Load historical performance (last 4 weeks)
    const currentStrategy = await getStrategyState();
    const contentScores =
      (await getState<Record<string, ContentScore>>("content_scores")) ?? {};

    // Gather last 4 weeks of aggregated feedback
    const weeklyData: any[] = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      const data = await getState(`feedback:aggregated:${dateKey}`);
      if (data) weeklyData.push({ date: dateKey, ...data });
    }

    // Step 2: AI analyzes patterns and recommends strategy updates
    const { text } = await generateText({
      model: models.analysis,
      system: STRATEGY_UPDATE_PROMPT,
      prompt: `
## Current Strategy State
${JSON.stringify(currentStrategy, null, 2)}

## Content Scores (all-time, with decay applied)
${Object.entries(contentScores)
  .sort(([, a], [, b]) => b.compositeScore - a.compositeScore)
  .slice(0, 30)
  .map(([slug, score]) => `- ${slug}: score=${score.compositeScore.toFixed(1)}, type=${score.type}, gsc=${score.gscClicks}, social=${score.socialEngagement}, views=${score.pageViews}`)
  .join("\n") || "No scores yet — first week"}

## Historical Performance (last 4 weeks)
${weeklyData.map((d) => `- ${d.date}: social=${d.socialMetricsCount ?? 0}, gsc=${d.gscQueryCount ?? 0}, pages=${d.analyticsPageCount ?? 0}`).join("\n") || "No historical data yet — first run"}

Based on this data, return an updated strategy state as JSON.
Rules:
1. No single content type weight can exceed 0.6 or go below 0.1
2. No single platform weight can exceed 0.5 or go below 0.05
3. Exploration budget must stay between 0.1 and 0.3
4. Include a "changelog" field explaining what changed and why
5. If there's insufficient data (first few weeks), make conservative adjustments only

Return valid JSON matching the StrategyState type.`,
    });

    let newStrategy: StrategyState;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      newStrategy = JSON.parse(jsonMatch?.[0] ?? "{}");
      // Validate bounds
      const ctw = newStrategy.contentTypeWeights;
      if (ctw) {
        ctw.blog = Math.max(0.1, Math.min(0.6, ctw.blog));
        ctw.social = Math.max(0.1, Math.min(0.6, ctw.social));
        ctw.comparison = Math.max(0.1, Math.min(0.6, ctw.comparison));
      }
      if (newStrategy.explorationBudget !== undefined) {
        newStrategy.explorationBudget = Math.max(
          0.1,
          Math.min(0.3, newStrategy.explorationBudget)
        );
      }
      newStrategy.updatedAt = new Date().toISOString();
    } catch {
      console.error("Failed to parse strategy update — keeping current");
      newStrategy = {
        ...currentStrategy,
        updatedAt: new Date().toISOString(),
        changelog: "Parse error — no changes applied",
      };
    }

    await setStrategyState(newStrategy);

    // Step 3: Generate weekly report
    const { text: report } = await generateText({
      model: models.fast,
      prompt: `
Generate a concise weekly content pipeline report in markdown.

## Pipeline Performance This Week
- Days with feedback data: ${weeklyData.length}
- Total content scores tracked: ${Object.keys(contentScores).length}
- Top performing content: ${Object.entries(contentScores).sort(([, a], [, b]) => b.compositeScore - a.compositeScore).slice(0, 3).map(([slug]) => slug).join(", ") || "N/A"}

## Strategy Changes
${newStrategy.changelog}

## Current Strategy Weights
- Content types: blog=${newStrategy.contentTypeWeights?.blog}, social=${newStrategy.contentTypeWeights?.social}, comparison=${newStrategy.contentTypeWeights?.comparison}
- Top platforms: ${Object.entries(newStrategy.platformWeights ?? {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([p, w]) => `${p}=${w}`).join(", ")}
- Hot topics: ${newStrategy.hotTopics?.slice(0, 5).join(", ")}
- Exploration budget: ${newStrategy.explorationBudget}

Format as a clean markdown report with sections.`,
    });

    const reportsDir = path.join(process.cwd(), ".pipeline-reports");
    await mkdir(reportsDir, { recursive: true });
    const reportDate = new Date().toISOString().split("T")[0];
    const reportPath = path.join(reportsDir, `${reportDate}.md`);
    await writeFile(reportPath, report, "utf-8");

    const changes = newStrategy.changelog
      ? newStrategy.changelog.split(". ").filter(Boolean)
      : ["No changes"];

    await logPipelineRun({
      stage: "improve",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      summary: `Strategy updated: ${newStrategy.changelog}. Report saved to ${reportPath}`,
    });

    return { changesApplied: changes, reportPath };
  } catch (error) {
    await logPipelineRun({
      stage: "improve",
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      summary: "Improve workflow failed",
      error: String(error),
    });
    throw error;
  }
}
