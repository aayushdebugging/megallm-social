# automating_advertisement

**Primary workflow:** **unified engagement UI** + **`tools/*-assistants`** (Reddit, Dev.to, Hacker News, Bluesky, X). One root `package.json` — `npm install` once.

## Unified dashboard (recommended)

```bash
npm install
cp .env.example .env   # MEGALLM_API_KEY, UNIFIED_ASSISTANT_*, etc.

npm run assistant:unified
```

Open [http://localhost:3500](http://localhost:3500) — see `.env.example` for `UNIFIED_ASSISTANT_*`.

Per-tool CLIs and optional standalone servers: [docs/assistants.md](docs/assistants.md).

---

## Next.js app (content pipeline)

Optional SEO/content pipeline and site — same repo, same `npm install`.

```bash
npm run dev    # http://localhost:3000
```

| Doc | Contents |
|-----|----------|
| [docs/README.md](docs/README.md) | Doc index |
| [docs/devto-automation.md](docs/devto-automation.md) | Dev.to queue + scheduler |
| [docs/assistants.md](docs/assistants.md) | Assistants + `assistant:*` scripts |

**Pipeline scripts:** `npm run generate`, `post`, `post:schedule`, etc.  
**Dev helpers:** `npm run dev:seed-post-queue`, `dev:reset-queue-head`
