import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Always tools/reddit-assistant/data — cwd-independent */
export const DATA_DIR = join(__dirname, "data");
export const POSTS_FILE = join(DATA_DIR, "posts.json");
export const DRAFTS_FILE = join(DATA_DIR, "drafts.json");
export const SIMS_DIR = join(DATA_DIR, "simulations");
