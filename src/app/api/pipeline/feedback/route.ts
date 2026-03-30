import { NextResponse } from "next/server";
import { runFeedback } from "@/workflows/feedback";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFeedback();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Feedback pipeline failed:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
