import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, "data");
export const TWEETS_FILE = path.join(DATA_DIR, "tweets.json");
export const DRAFTS_FILE = path.join(DATA_DIR, "drafts.json");
export const POSTS_FILE = path.join(DATA_DIR, "posts.json");
