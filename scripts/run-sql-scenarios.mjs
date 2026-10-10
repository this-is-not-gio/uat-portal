// Runs the SQL scenario scripts in supabase/tests against a Supabase project or branch.
// Each scenario runs in one transaction that is always rolled back.
// See supabase/tests/README.md for usage.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const root = resolve(import.meta.dirname, "..");
const testsDir = join(root, "supabase", "tests");

const args = process.argv.slice(2);
const pre = [];
const only = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pre") pre.push(args[++i]);
    else only.push(args[i]);
}

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
    console.error("Set SUPABASE_PROJECT_REF (the branch's project ref) and SUPABASE_ACCESS_TOKEN (a personal access token).");
    process.exit(2);
}

const helpers = readFileSync(join(testsDir, "_helpers.sql"), "utf8");
const preSql = pre.map((p) => `-- pre: ${p}\n${readFileSync(resolve(p), "utf8")}`).join("\n");
const files = readdirSync(testsDir)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .filter((f) => only.length === 0 || only.some((o) => f.includes(basename(o))))
    .sort();

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

let failed = 0;
for (const file of files) {
    const scenario = readFileSync(join(testsDir, file), "utf8");
    const sql = [
        "begin;",
        "set local statement_timeout = '60s';",
        preSql,
        helpers,
        scenario,
        "select n, label, ok, detail from pg_temp.t_results order by n;",
        "rollback;",
    ].join("\n");

    console.log(`\n${file}`);
    try {
        const rows = await run(sql);
        if (!Array.isArray(rows) || rows.length === 0) {
            console.log("  ✗ no assertions ran");
            failed++;
            continue;
        }
        for (const r of rows) {
            console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}${r.ok ? "" : `  (${r.detail})`}`);
            if (!r.ok) failed++;
        }
    } catch (e) {
        console.log(`  ✗ scenario errored: ${e instanceof Error ? e.message : e}`);
        failed++;
    }
}

console.log(failed ? `\n${failed} failure(s)` : "\nall passed");
process.exit(failed ? 1 : 0);
