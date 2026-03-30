#!/usr/bin/env node
import "./load-env.js";
import { CONFIG, validateLlm } from "./config.js";

console.log("\n🔧 HN Assistant configuration\n");

console.log("Hacker News:");
console.log(`  List: ${CONFIG.hn.list} (top | new | best via HN_LIST)`);
console.log(`  Max stories saved: ${CONFIG.hn.maxStories}`);
console.log(`  Min score: ${CONFIG.hn.minScore}`);

console.log("\nMegaLLM:");
console.log(`  MEGALLM_API_KEY: ${CONFIG.apiKey ? "✅ Set" : "❌ Not set"}`);
console.log(`  Base URL: ${CONFIG.apiBaseUrl}`);
console.log(`  Model: ${CONFIG.model}`);

console.log("\nDashboard:");
console.log(`  Port: ${CONFIG.port} (HN_ASSISTANT_PORT)`);

try {
  validateLlm();
  console.log("\n✅ LLM config OK for drafting\n");
} catch (e) {
  console.log(`\n⚠️  ${e.message}\n`);
}
