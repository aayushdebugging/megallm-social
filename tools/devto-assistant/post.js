#!/usr/bin/env node
/**
 * Post a single article to Dev.to (queue or JSON arg)
 */
import "./load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG, validateDevtoPosting } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeTag(tag) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function getTags(defaultTags = []) {
  const normalized = CONFIG.defaultTags.map(normalizeTag).filter((tag) => tag.length > 0);
  const custom = (defaultTags || []).map(normalizeTag).filter((tag) => tag.length > 0);
  const combined = Array.from(new Set([...normalized, ...custom])).slice(0, 4);
  return combined.length > 0 ? combined : ["ai", "llm"];
}

async function postToDevTo(article) {
  if (!CONFIG.devtoApiKey) {
    throw new Error("DEVTO_API_KEY not set");
  }

  const res = await fetch(`${CONFIG.devtoApiUrl}/articles`, {
    method: "POST",
    headers: {
      "api-key": CONFIG.devtoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      article: {
        title: article.title || "Dev.to Update",
        body_markdown: article.content,
        published: CONFIG.publishImmediately,
        tags: getTags(article.tags),
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Dev.to API error: ${res.status} ${error}`);
  }

  return res.json();
}

async function main() {
  validateDevtoPosting();

  const article = process.argv[2]
    ? JSON.parse(process.argv[2])
    : {
        title: "Test Post",
        content: "# Hello from Dev.to Assistant\n\nThis is a test post.",
        tags: ["test"],
      };

  console.log(`📝 Posting to Dev.to: "${article.title}"`);

  const data = await postToDevTo(article);

  console.log(`✅ Posted successfully!`);
  console.log(`   URL: ${data.url}`);
  console.log(`   ID: ${data.id}`);

  const postedLog = path.join(__dirname, "data", "posted.json");
  const existing = fs.existsSync(postedLog)
    ? JSON.parse(fs.readFileSync(postedLog, "utf8"))
    : [];
  existing.push({
    timestamp: new Date().toISOString(),
    title: article.title,
    url: data.url,
    id: data.id,
  });
  fs.writeFileSync(postedLog, JSON.stringify(existing, null, 2));
  console.log(`📊 Logged to data/posted.json`);
}

main().catch((e) => {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
});
