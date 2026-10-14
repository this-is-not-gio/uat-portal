// Applies supabase/migrations/*.sql to one Supabase project via the Management API.
// Applied files are tracked by file name in repo_ops.applied_migrations (not supabase_migrations,
// whose version stamps don't match our file names).
//
//   node scripts/migrate.mjs            apply pending migrations
//   node scripts/migrate.mjs --dry-run  list pending migrations only
//   node scripts/migrate.mjs --baseline mark every file as applied WITHOUT running it (one-off, for a DB that already has them)
//
// Env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = join(resolve(import.meta.dirname, ".."), "supabase", "migrations");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const baseline = args.has("--baseline");

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
    console.error("Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN.");
    process.exit(2);
}

async function run(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(body);
    return JSON.parse(body);
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const trackingExists = (await run("select to_regclass('repo_ops.applied_migrations') as t"))[0]?.t !== null;

if (!trackingExists && !baseline) {
    console.error(
        "repo_ops.applied_migrations doesn't exist on this project.\n" +
            "If the DB already has every file in supabase/migrations, run once with --baseline.\n" +
            "If it's an empty DB, run with --baseline only after applying the files by hand, or pass --init-empty.",
    );
    if (!args.has("--init-empty")) process.exit(1);
}

await run(
    "create schema if not exists repo_ops;" +
        "create table if not exists repo_ops.applied_migrations (name text primary key, applied_at timestamptz not null default now());",
);

if (baseline) {
    const values = files.map((f) => `(${quote(f)})`).join(",");
    await run(`insert into repo_ops.applied_migrations (name) values ${values} on conflict do nothing;`);
    console.log(`Baselined ${files.length} migration(s) as applied.`);
    process.exit(0);
}

const applied = new Set((await run("select name from repo_ops.applied_migrations")).map((r) => r.name));
const pending = files.filter((f) => !applied.has(f));
const unknown = [...applied].filter((n) => !files.includes(n));
if (unknown.length) console.warn(`Note: applied but no longer in repo: ${unknown.join(", ")}`);

if (pending.length === 0) {
    console.log("No pending migrations.");
    process.exit(0);
}
console.log(`${pending.length} pending: ${pending.join(", ")}`);
if (dryRun) process.exit(0);

for (const f of pending) {
    // One request = one implicit transaction, so the file and its tracking row commit together.
    const sql = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`Applying ${f} … `);
    try {
        await run(`${sql}\n;\ninsert into repo_ops.applied_migrations (name) values (${quote(f)});`);
        console.log("ok");
    } catch (e) {
        console.log("FAILED");
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }
}
console.log("Done.");
