import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Set SUPABASE_DB_URL env var before running.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await client.query(sql);
  console.log("Schema applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
