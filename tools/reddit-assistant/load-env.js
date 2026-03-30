// Load .env.local from project root into process.env
// Import this BEFORE config.js to ensure env vars are available

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const envFile of ["../../.env.local", "../../.env", ".env.local", ".env"]) {
  const p = resolve(__dirname, envFile);
  if (existsSync(p)) {
    readFileSync(p, "utf-8").split("\n").forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
}
