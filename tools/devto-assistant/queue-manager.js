#!/usr/bin/env node
/**
 * Queue viewer for scheduled Dev.to posts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const queueFile = path.join(__dirname, "data", "queue.json");

function readQueue() {
  if (!fs.existsSync(queueFile)) return [];
  return JSON.parse(fs.readFileSync(queueFile, "utf8"));
}

function formatQueue(items, limit = 10) {
  if (items.length === 0) {
    console.log("Queue is empty");
    return;
  }

  console.log(`\n📋 Queue (${items.length} items):\n`);

  items.slice(0, limit).forEach((item, i) => {
    console.log(`${i + 1}. [${item.status.toUpperCase()}] ${item.title}`);
    console.log(
      `   ID: ${item.id} | Scheduled: ${new Date(item.scheduledTime).toLocaleString()}`
    );
    if (item.postedUrl) console.log(`   Posted: ${item.postedUrl}`);
    if (item.error) console.log(`   Error: ${item.error}`);
    console.log();
  });

  if (items.length > limit) {
    console.log(`... and ${items.length - limit} more items`);
  }
}

function viewQueue() {
  const limit = parseInt(process.argv[3], 10) || 10;
  formatQueue(readQueue(), limit);
}

function viewPending() {
  const pending = readQueue().filter((item) => item.status === "pending");
  console.log(`\n⏳ Pending posts: ${pending.length}\n`);
  formatQueue(pending, 10);
}

function clearQueue() {
  if (!fs.existsSync(queueFile)) {
    console.log("Queue file does not exist");
    return;
  }

  const backup = `${queueFile}.backup-${Date.now()}`;
  fs.copyFileSync(queueFile, backup);
  fs.writeFileSync(queueFile, JSON.stringify([], null, 2));
  console.log(`✅ Queue cleared`);
  console.log(`📦 Backup saved: ${backup}`);
}

function stats() {
  const queue = readQueue();
  const pending = queue.filter((item) => item.status === "pending").length;
  const posted = queue.filter((item) => item.status === "posted").length;
  const failed = queue.filter((item) => item.status === "failed").length;

  console.log(`\n📊 Queue Statistics:\n`);
  console.log(`   Total items: ${queue.length}`);
  console.log(`   ⏳ Pending: ${pending}`);
  console.log(`   ✅ Posted: ${posted}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Config queue: ${CONFIG.queueFile}\n`);
}

const command = process.argv[2] || "view";

switch (command) {
  case "view":
    viewQueue();
    break;
  case "pending":
    viewPending();
    break;
  case "clear":
    clearQueue();
    break;
  case "stats":
    stats();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log(`Available commands: view, pending, clear, stats`);
    process.exit(1);
}
