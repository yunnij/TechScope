import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env");

function parseEnvFile(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.warn("[sync-d1-id] .env not found. Skipping D1 database_id sync.");
    return null;
  }

  const parsed = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  if (!parsed.D1_DATABASE_ID) {
    console.warn("[sync-d1-id] D1_DATABASE_ID is missing in .env. Skipping.");
    return null;
  }

  return parsed;
}

function replaceDatabaseId(filePath, nextDatabaseId) {
  const fullPath = path.join(rootDir, filePath);
  const current = fs.readFileSync(fullPath, "utf8");
  const updated = current.replace(
    /^database_id\s*=\s*"[^"]*"/m,
    `database_id = "${nextDatabaseId}"`
  );

  if (updated === current) {
    throw new Error(`database_id line not found in ${filePath}`);
  }

  fs.writeFileSync(fullPath, updated, "utf8");
  console.log(`[sync-d1-id] Updated ${filePath}`);
}

const env = loadEnv();
if (env) {
  replaceDatabaseId("wrangler.toml", env.D1_DATABASE_ID);
  replaceDatabaseId(path.join("workers", "crawler", "wrangler.toml"), env.D1_DATABASE_ID);
}
