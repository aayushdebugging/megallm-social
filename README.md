# automating_advertisement

Monorepo: **Next.js** content/SEO pipeline plus **local engagement assistants** (Reddit, Dev.to, Hacker News, Bluesky). **One `package.json`** at the repo root — run `npm install` once.

## Quick start

```bash
npm install
cp .env.example .env   # then fill keys
npm run dev            # http://localhost:3000
```

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/README.md](docs/README.md) | Doc index |
| [docs/devto-automation.md](docs/devto-automation.md) | Dev.to queue + scheduler |
| [docs/assistants.md](docs/assistants.md) | Engagement assistants + `npm run assistant:*` |

## Main npm scripts

- `npm run generate` — pipeline: generate content variants  
- `npm run post` — post pending queue once  
- `npm run post:schedule` — post on an interval  
- `npm run dev:seed-post-queue` / `dev:reset-queue-head` — dev queue helpers  

## Engagement dashboard (all platforms, one UI)

```bash
npm run assistant:unified
```

Default: [http://localhost:3500](http://localhost:3500) — set `UNIFIED_ASSISTANT_*` in `.env` (see `.env.example`).

Other assistants: `npm run assistant:reddit`, `assistant:devto`, `assistant:hn`, `assistant:bluesky:*` — see [docs/assistants.md](docs/assistants.md).
