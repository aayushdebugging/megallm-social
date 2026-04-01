# Engagement assistants (`tools/`)

Small Node apps that **fetch** public posts, **draft** reply options with **MegaLLM**, and let you **copy/paste** on the real site. Data lives in each tool’s `data/` directory (`posts.json`, `drafts.json`). Env is read from the **repo root** `.env` / `.env.local` (`MEGALLM_API_KEY`, optional `MEGALLM_BASE_URL`, `MODEL`).

**Dependencies:** install once at the **repository root**: `npm install` (Express + `express-session` are in the root `package.json`).

## Unified dashboard (recommended)

```bash
npm run assistant:unified
```

- URL: `http://localhost:3500` (override with `UNIFIED_ASSISTANT_PORT`).  
- Auth: `UNIFIED_ASSISTANT_USER` / `UNIFIED_ASSISTANT_PASSWORD` / `UNIFIED_SESSION_SECRET` — see `.env.example`.

## Per-platform scripts

| Script | Role |
|--------|------|
| `npm run assistant:reddit` | Standalone Reddit dashboard (default port 3456) |
| `npm run assistant:reddit:fetch` / `:draft` / `:simulate` | Reddit CLI |
| `npm run assistant:devto` | Standalone Dev.to dashboard (3457) |
| `npm run assistant:devto:fetch` / `:draft` / `:simulate` | Dev.to CLI |
| `npm run assistant:devto:post` / `:schedule` | Posting / schedule |
| `npm run assistant:devto:queue:view` / `:queue:clear` | Queue manager |
| `npm run assistant:devto:test` | Config check |
| `npm run assistant:hn` | Standalone HN dashboard (3458) |
| `npm run assistant:hn:fetch` / `:draft` / `:test` | HN CLI |
| `npm run assistant:x` | Standalone X (Twitter) dashboard (3459) |
| `npm run assistant:x:fetch` / `:draft` | X CLI |
| `npm run assistant:bluesky:fetch` / `:draft` | Bluesky CLI (no extra deps) |

Default ports are set in each assistant’s `config.js` / `server.js` if you run the standalone servers.

## Dev.to assistant extras

- `assistant:devto:simulate` — simulated threads under `tools/devto-assistant/data/simulations/`

## Repo-root dev scripts

Run from **repository root**:

| Script | Command |
|--------|---------|
| Seed sample `post_queue.json` | `npm run dev:seed-post-queue` |
| Reset first 3 rows in `content_queue.json` to pending | `npm run dev:reset-queue-head` |

Source: `scripts/dev/create-posts.js`, `scripts/dev/check-queue.js`.
