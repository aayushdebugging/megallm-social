// Load environment variables from repo root .env / .env.local
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../../");

// Try .env.local first, then .env
const envLocal = path.join(repoRoot, ".env.local");
const envFile = path.join(repoRoot, ".env");

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}
