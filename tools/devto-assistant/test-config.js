#!/usr/bin/env node
import "./load-env.js";
import { CONFIG, validateDevtoPosting, validateLlm } from "./config.js";

console.log("\n🔧 Dev.to Assistant configuration\n");

console.log("Dev.to API (posting / schedule):");
console.log(`  API Key: ${CONFIG.devtoApiKey ? "✅ Set" : "❌ Not set"}`);
console.log(`  Username: ${CONFIG.devtoUsername ? "✅ " + CONFIG.devtoUsername : "❌ Not set"}`);
console.log(`  Publish immediately: ${CONFIG.publishImmediately ? "✅ Yes" : "⏸️  Draft mode"}`);
console.log(`  Default tags: ${CONFIG.defaultTags.join(", ")}`);
console.log(`  Post interval: ${CONFIG.postIntervalMs / 1000}s`);

console.log("\nLLM (fetch / draft / simulation):");
console.log(
  `  LLM key: ${CONFIG.apiKey ? "✅ Set" : "❌ Not set"} (MEGALLM_API_KEY)`
);
console.log(`  Base URL: ${CONFIG.apiBaseUrl}`);
console.log(`  Model: ${CONFIG.model}`);

console.log("\nDashboard:");
console.log(`  Port: ${CONFIG.port}`);

console.log("\nValidation:");
try {
  validateDevtoPosting();
  console.log("  Dev.to posting: ✅");
} catch (e) {
  console.log(`  Dev.to posting: ❌ ${e.message}`);
}

try {
  validateLlm();
  console.log("  LLM drafting: ✅");
} catch (e) {
  console.log(`  LLM drafting: ⚠️  ${e.message} (needed for dashboard AI features)`);
}

console.log("\nCommands:");
console.log("  npm start              — comment assistant UI");
console.log("  npm run fetch          — pull articles by tag");
console.log("  npm run draft          — draft comments");
console.log("  npm run schedule       — post queued articles");
console.log("  node queue-manager.js stats\n");
