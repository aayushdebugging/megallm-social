import { NextResponse } from "next/server";
import { runAnalyze } from "@/workflows/analyze";

export async function GET(req: Request) {
  // Verify cron secret in production
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAnalyze();
    return NextResponse.json({
      ok: true,
      trendingTopics: result.trendingTopics.length,
      newModels: result.newModelsDetected.length,
      queuedItems: result.recommendedQueue.length,
    });
  } catch (error) {
    console.error("Analyze pipeline failed:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
