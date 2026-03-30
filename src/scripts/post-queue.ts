// Standalone Playwright posting script
// Reads the post queue and posts each pending item
// Usage: tsx src/scripts/post-queue.ts [--dry-run]

import { runPost } from "../workflows/post";

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n📤 Post Queue Runner ${isDryRun ? "(DRY RUN)" : ""}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  if (isDryRun) {
    const { getList } = await import("../lib/pipeline/state");
    const queue = await getList("post_queue");
    const pending = queue.filter(
      (item: any) => item.status === "pending"
    );
    console.log(`Pending posts: ${pending.length}`);
    for (const item of pending) {
      const p = item as any;
      console.log(`  - [${p.platform}] ${p.title ?? p.content.slice(0, 60)}...`);
    }
    return;
  }

  const result = await runPost();
  console.log(`\nResults: ${result.posted} posted, ${result.failed} failed`);
}

main().catch(console.error);
