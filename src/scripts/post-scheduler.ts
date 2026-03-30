/**
 * Post Scheduler - Automatically posts queued items every N minutes
 * Usage: npm run post:schedule (posts every 1 minute)
 *
 * This scheduler:
 * - Runs the POST pipeline at fixed intervals
 * - Posts all pending dev.to content (and other platforms if credentials available)
 * - Logs results to console
 * - Continues running until interrupted (Ctrl+C)
 *
 * To stop: Press Ctrl+C in the terminal
 */

import { runPost } from "@/workflows/post";

const POST_INTERVAL_MS = 60 * 1000; // 1 minute = 60,000 ms
let postCount = 0;
let failCount = 0;

async function post() {
  try {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${now}] Posting cycle ${++postCount}...`);
    
    const result = await runPost();
    
    failCount += result.failed;
    
    if (result.posted > 0) {
      console.log(
        `${new Date().toLocaleTimeString()} ✅ Posted: ${result.posted}, Failed: ${result.failed}`
      );
    } else if (result.failed > 0) {
      console.log(
        `${new Date().toLocaleTimeString()} ⚠️  Posted: ${result.posted}, Failed: ${result.failed}`
      );
    } else {
      console.log(`${new Date().toLocaleTimeString()} ℹ️  No pending posts`);
    }
  } catch (error) {
    console.error(`Error during posting cycle:`, error);
  }
}

async function startScheduler() {
  console.log("🚀 Starting post scheduler...");
  console.log(`⏱️  Posting interval: every ${POST_INTERVAL_MS / 1000} seconds`);
  console.log("📍 Press Ctrl+C to stop\n");

  // Post immediately on startup
  await post();

  // Then schedule recurring posts
  setInterval(post, POST_INTERVAL_MS);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(
      `\n\n📊 Scheduler stopped. Summary: Posted ${postCount} cycles, Total failures: ${failCount}`
    );
    process.exit(0);
  });
}

startScheduler().catch((error) => {
  console.error("Scheduler failed to start:", error);
  process.exit(1);
});
