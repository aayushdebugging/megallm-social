# Dev.to automation

Pipeline is configured so **blog** and **Dev.to** are the main external targets; other social platforms are skipped in `src/lib/pipeline/distribution.ts` (adjust there if you want multi-platform rotation again).

## Environment

In `.env`:

```env
DEVTO_API_KEY=your_key
DEVTO_USERNAME=your_username
DEVTO_PUBLISH_IMMEDIATELY=true
DEVTO_DEFAULT_TAGS=megallm,viral,trending
```

Get an API key: [dev.to/settings/account](https://dev.to/settings/account).

## Day-to-day commands

**Generate** content (queues items):

```bash
npm run generate
```

**Post once** (all pending, then exit):

```bash
npm run post
```

**Scheduler** (default: every 60 seconds — edit `POST_INTERVAL_MS` in `src/scripts/post-scheduler.ts`):

```bash
npm run post:schedule
```

Typical setup: one terminal `npm run generate`, another `npm run post:schedule`. Stop the scheduler with `Ctrl+C`.

## State files

- `.pipeline-state/post_queue.json` — pending / posted / failed  
- `.pipeline-state/last_post.json` — last run summary  

Inspect pending (Unix):

```bash
node -e "const q=require('./.pipeline-state/post_queue.json'); console.log(q.filter(p=>p.status==='pending').length, 'pending')"
```

## Troubleshooting

- **`DEVTO_API_KEY not set`** — ensure `.env` is loaded from the repo root; restart the terminal/process.  
- **No posts going out** — run `npm run generate`; confirm queue entries have `"status": "pending"`.  
- **Change interval** — `src/scripts/post-scheduler.ts` → `POST_INTERVAL_MS`.  

## Related code

| Area | Path |
|------|------|
| Scheduler | `src/scripts/post-scheduler.ts` |
| Dev.to poster | `src/scripts/posters/devto.ts` |
| Distribution | `src/lib/pipeline/distribution.ts` |
| Generate / post workflows | `src/workflows/` |

Dev.to API reference: [docs.dev.to/api](https://docs.dev.to/api/).
