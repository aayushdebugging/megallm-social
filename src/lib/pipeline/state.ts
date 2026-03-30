// ─────────────────────────────────────────────────────────────
// Pipeline state manager — filesystem-based JSON store
//
// Every "key" maps to a JSON file in .pipeline-state/.
// This module is the single abstraction layer so we can swap
// to Vercel KV (or any other store) later without touching
// the rest of the pipeline.
// ─────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";

import type {
  ContentQueueItem,
  ContentScore,
  PipelineRun,
  PostQueueItem,
  StrategyState,
} from "./types";
import { DEFAULT_STRATEGY } from "./strategy";

const STATE_DIR = path.join(process.cwd(), ".pipeline-state");

// ── Low-level helpers ──────────────────────────────────────

/** Ensure the .pipeline-state directory exists. */
export async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

function keyPath(key: string): string {
  // Sanitise the key so it is a safe filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STATE_DIR, `${safe}.json`);
}

/**
 * Read a value from the state store.
 * Returns `null` when the key does not exist.
 */
export async function getState<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(keyPath(key), "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Write a value to the state store (overwrites any existing value).
 */
export async function setState<T>(key: string, value: T): Promise<void> {
  await ensureStateDir();
  await fs.writeFile(keyPath(key), JSON.stringify(value, null, 2), "utf-8");
}

/**
 * Append an item to a JSON array stored under `key`.
 * If the key does not exist yet a new array is created.
 */
export async function appendToList<T>(key: string, item: T): Promise<void> {
  const existing = await getState<T[]>(key);
  const list = existing ?? [];
  list.push(item);
  await setState(key, list);
}

/**
 * Read a JSON array stored under `key`.
 * Returns an empty array when the key does not exist.
 */
export async function getList<T>(key: string): Promise<T[]> {
  return (await getState<T[]>(key)) ?? [];
}

// ── Convenience accessors ──────────────────────────────────

/** Retrieve the full content generation queue. */
export async function getContentQueue(): Promise<ContentQueueItem[]> {
  return getList<ContentQueueItem>("content_queue");
}

/** Retrieve the full post / distribution queue. */
export async function getPostQueue(): Promise<PostQueueItem[]> {
  return getList<PostQueueItem>("post_queue");
}

/**
 * Retrieve the current strategy state.
 * Falls back to `DEFAULT_STRATEGY` when no state has been persisted yet.
 */
export async function getStrategyState(): Promise<StrategyState> {
  const state = await getState<StrategyState>("strategy");
  return state ?? { ...DEFAULT_STRATEGY };
}

/** Persist a new strategy state (called by the IMPROVE stage). */
export async function setStrategyState(state: StrategyState): Promise<void> {
  await setState("strategy", state);
}

/**
 * Retrieve all content scores keyed by content ID.
 * Returns an empty record when no scores exist yet.
 */
export async function getContentScores(): Promise<Record<string, ContentScore>> {
  return (await getState<Record<string, ContentScore>>("content_scores")) ?? {};
}

/** Append a pipeline run entry to the run log. */
export async function logPipelineRun(run: PipelineRun): Promise<void> {
  await appendToList<PipelineRun>("pipeline_runs", run);
}

// ── Internal utilities ─────────────────────────────────────

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
