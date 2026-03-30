import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Always tools/hackernews-assistant/data — independent of process.cwd() */
export const DATA_DIR = join(__dirname, "data");
export const POSTS_FILE = join(DATA_DIR, "posts.json");
export const DRAFTS_FILE = join(DATA_DIR, "drafts.json");
