// CLI runner for pipeline stages
// Usage: tsx src/scripts/run-pipeline.ts <stage>

import "dotenv/config";
import { runAnalyze } from "../workflows/analyze";
import { runGenerate } from "../workflows/generate";
import { runPost } from "../workflows/post";
import { runFeedback } from "../workflows/feedback";
import { runImprove } from "../workflows/improve";

const stage = process.argv[2];

const stages: Record<string, () => Promise<any>> = {
  analyze: runAnalyze,
  generate: runGenerate,
  post: runPost,
  feedback: runFeedback,
  improve: runImprove,
};

async function main() {
  if (!stage || !stages[stage]) {
    console.error(`Usage: tsx src/scripts/run-pipeline.ts <stage>`);
    console.error(`Stages: ${Object.keys(stages).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🔄 Running pipeline stage: ${stage}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    const result = await stages[stage]();
    console.log(`\n✅ ${stage} completed successfully`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`\n❌ ${stage} failed:`, error);
    process.exit(1);
  }
}

main();
