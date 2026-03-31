// ─────────────────────────────────────────────────────────────
// X (Twitter) Assistant — Standalone dashboard
// Fetch tweets, draft replies, copy/paste to X manually
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import express from "express";
import { readFile, writeFile, mkdir } from "fs/promises";
import { DATA_DIR, TWEETS_FILE, DRAFTS_FILE } from "./paths.js";
import { CONFIG } from "./config.js";
import { fetchAllTweets } from "./fetch-tweets.js";
import { draftComments } from "./draft-comments.js";

const app = express();
app.use(express.json());

// Simple HTML dashboard
const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X Assistant — MegaLLM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: #000; color: #fff; padding: 16px; margin: -20px -20px 20px; text-align: center; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .section { margin: 20px 0; }
    .controls { display: flex; gap: 10px; margin-bottom: 16px; }
    button { padding: 10px 16px; font-size: 14px; border: 1px solid #666; background: #f5f5f5; cursor: pointer; border-radius: 4px; }
    button:hover { background: #e0e0e0; }
    button.primary { background: #1da1f2; color: white; border: none; }
    button.primary:hover { background: #1a8cd8; }
    .tweets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .tweet-card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; background: #f9f9f9; }
    .tweet-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .tweet-author { font-weight: bold; color: #000; }
    .tweet-verified { color: #1da1f2; }
    .tweet-text { color: #333; line-height: 1.4; margin-bottom: 8px; font-size: 14px; }
    .tweet-meta { color: #657786; font-size: 12px; display: flex; gap: 12px; }
    .tweet-meta span { display: flex; align-items: center; gap: 4px; }
    .tweet-engagement { color: #1da1f2; text-decoration: none; font-size: 12px; margin-top: 8px; display: block; }
    .drafts-container { margin-top: 40px; }
    .draft-card { border-left: 4px solid #1da1f2; padding: 12px; background: #f0f7ff; margin-bottom: 12px; border-radius: 4px; }
    .draft-reply { background: #fff; padding: 8px 12px; border-radius: 4px; margin: 8px 0; font-family: monospace; font-size: 12px; color: #333; }
    .draft-meta { font-size: 11px; color: #666; margin-top: 4px; }
    .copy-btn { background: #1da1f2; color: white; padding: 6px 12px; font-size: 11px; border: none; cursor: pointer; border-radius: 2px; }
    .copy-btn:hover { background: #1a8cd8; }
    .status { padding: 12px; background: #e8f5e9; border-radius: 4px; color: #2e7d32; margin-bottom: 16px; }
    .status.loading { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <header>
    <h1>𝕏 Assistant</h1>
    <p>MegaLLM — Draft replies to trending tweets</p>
  </header>
  
  <div class="container">
    <div class="controls">
      <button class="primary" onclick="fetchTweets()">🔄 Fetch Tweets</button>
      <button class="primary" onclick="draftReplies()">✍️ Draft Replies</button>
      <button onclick="location.reload()">↻ Refresh</button>
    </div>

    <div id="status"></div>

    <div class="section">
      <h2>Fetched Tweets (<span id="tweet-count">0</span>)</h2>
      <div id="tweets" class="tweets-grid"></div>
    </div>

    <div class="section drafts-container">
      <h2>Draft Replies (<span id="draft-count">0</span>)</h2>
      <div id="drafts"></div>
    </div>
  </div>

  <script>
    async function fetchTweets() {
      showStatus('Fetching tweets...', 'loading');
      try {
        const res = await fetch('/api/fetch-tweets', { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        showStatus(\`✓ Fetched \${data.count} tweets\`);
        loadTweets();
      } catch (e) {
        showStatus('✗ ' + e.message);
      }
    }

    async function draftReplies() {
      showStatus('Drafting replies...', 'loading');
      try {
        const res = await fetch('/api/draft-replies', { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        showStatus(\`✓ Drafted \${data.count} reply options\`);
        loadDrafts();
      } catch (e) {
        showStatus('✗ ' + e.message);
      }
    }

    async function loadTweets() {
      try {
        const res = await fetch('/api/tweets');
        const tweets = await res.json();
        document.getElementById('tweet-count').textContent = tweets.length;
        
        const html = tweets.map(t => \`
          <div class="tweet-card">
            <div class="tweet-header">
              <div>
                <div class="tweet-author">@\${t.authorUsername}\${t.authorVerified ? '<span class="tweet-verified">✓</span>' : ''}</div>
              </div>
            </div>
            <div class="tweet-text">\${escapeHtml(t.text)}</div>
            <div class="tweet-meta">
              <span>❤️ \${t.likes}</span>
              <span>💬 \${t.replies}</span>
              <span>🔄 \${t.retweets}</span>
            </div>
            <a href="\${t.url}" target="_blank" class="tweet-engagement">Open on X →</a>
          </div>
        \`).join('');
        
        document.getElementById('tweets').innerHTML = html || '<p>No tweets. Click "Fetch Tweets" to start.</p>';
      } catch (e) {
        console.error(e);
      }
    }

    async function loadDrafts() {
      try {
        const res = await fetch('/api/drafts');
        const drafts = await res.json();
        document.getElementById('draft-count').textContent = drafts.length;
        
        const html = drafts.map(d => \`
          <div class="draft-card">
            <strong>@\${d.authorUsername}</strong> | \${d.replyType} (\${d.engagementLevel} engagement)
            <div class="draft-reply">\${escapeHtml(d.replyText)}</div>
            <div class="draft-meta">Score: \${d.megallmScore} | <a href="\${d.url}" target="_blank">Original tweet</a></div>
            <button class="copy-btn" onclick="copyToClipboard('\${d.replyText}')">📋 Copy</button>
          </div>
        \`).join('');
        
        document.getElementById('drafts').innerHTML = html || '<p>No drafts. Click "Draft Replies" to generate.</p>';
      } catch (e) {
        console.error(e);
      }
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
      });
    }

    function showStatus(msg, cls = '') {
      const el = document.getElementById('status');
      el.textContent = msg;
      el.className = 'status ' + cls;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load on start
    loadTweets();
    loadDrafts();
  </script>
</body>
</html>
`;

// Routes
app.get("/", (req, res) => {
  res.send(HTML);
});

app.get("/api/tweets", async (req, res) => {
  try {
    const data = await readFile(TWEETS_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.get("/api/drafts", async (req, res) => {
  try {
    const data = await readFile(DRAFTS_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.post("/api/fetch-tweets", async (req, res) => {
  try {
    const tweets = await fetchAllTweets();
    res.json({ count: tweets.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/draft-replies", async (req, res) => {
  try {
    const drafts = await draftComments();
    res.json({ count: drafts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = CONFIG.port;
app.listen(PORT, () => {
  console.log(`\n✓ X Assistant running at http://localhost:${PORT}\n`);
  console.log(`  Env: X_BEARER_TOKEN="${CONFIG.xBearerToken ? "✓" : "✗"}"`);
  console.log(`      MEGALLM_API_KEY="${CONFIG.apiKey ? "✓" : "✗"}"\n`);
});
