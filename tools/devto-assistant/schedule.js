#!/usr/bin/env node
/**
 * Post queued articles to Dev.to on an interval
 */
import "./load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG, validateDevtoPosting } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let postCount = 0;
let failureCount = 0;

function queuePath() {
  return path.join(__dirname, CONFIG.queueFile.replace(/^\.\//, ""));
}

function readQueue() {
  const p = queuePath();
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeQueue(queue) {
  fs.writeFileSync(queuePath(), JSON.stringify(queue, null, 2));
}

function getPending() {
  return readQueue().filter(
    (item) =>
      item.status === "pending" && new Date(item.scheduledTime) <= new Date()
  );
}

function normalizeTag(tag) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function getTags(defaultTags = []) {
  const normalized = CONFIG.defaultTags.map(normalizeTag).filter((t) => t.length > 0);
  const custom = (defaultTags || []).map(normalizeTag).filter((t) => t.length > 0);
  const combined = Array.from(new Set([...normalized, ...custom])).slice(0, 4);
  return combined.length > 0 ? combined : ["ai", "llm"];
}

async function postToDevTo(article) {
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
    throw new Error(`${res.status}: ${error}`);
  }

  return res.json();
}

async function postCycle() {
  try {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${now}] Posting cycle ${++postCount}...`);

    const pending = getPending();
    if (pending.length === 0) {
      console.log(`   ℹ️  No pending posts`);
      return;
    }

    const queue = readQueue();
    let posted = 0;

    for (const item of pending) {
      try {
        const result = await postToDevTo(item);
        item.status = "posted";
        item.postedId = String(result.id);
        item.postedUrl = result.url;
        item.postedAt = new Date().toISOString();
        posted++;
      } catch (error) {
        console.error(`   Error posting "${item.title}": ${error.message}`);
        item.status = "failed";
        item.error = error.message;
        failureCount++;
      }
    }

    writeQueue(queue);

    if (posted > 0) console.log(`   ✅ Posted: ${posted}`);
    if (failureCount > 0) console.log(`   ⚠️  Failures so far: ${failureCount}`);
  } catch (error) {
    console.error(`Error during posting cycle: ${error.message}`);
  }
}

async function startScheduler() {
  validateDevtoPosting();

  console.log("🚀 Starting Dev.to scheduler...");
  console.log(`⏱️  Posting interval: every ${CONFIG.postIntervalMs / 1000} seconds`);
  console.log("📍 Press Ctrl+C to stop\n");

  await postCycle();
  setInterval(postCycle, CONFIG.postIntervalMs);

  process.on("SIGINT", () => {
    console.log(
      `\n\n📊 Scheduler stopped. Summary: ${postCount} cycles, ${failureCount} failures`
    );
    process.exit(0);
  });
}

startScheduler();
