import pg from "pg";

const regions = [
  "us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-north-1",
  "ap-southeast-1","ap-southeast-2","ap-south-1","ap-northeast-1","ap-northeast-2",
  "sa-east-1","ca-central-1",
];

const ref = "mmqmmxmuocaexgjrbbmy";
const password = process.env.SUPABASE_DB_PASSWORD;

async function tryRegion(region) {
  const client = new pg.Client({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    return true;
  } catch (err) {
    try { await client.end(); } catch {}
    return false;
  }
}

for (const region of regions) {
  process.stdout.write(`${region}... `);
  const ok = await tryRegion(region);
  console.log(ok ? "MATCH" : "no");
  if (ok) {
    console.log(`FOUND: ${region}`);
    process.exit(0);
  }
}
console.log("no region matched");
process.exit(1);
