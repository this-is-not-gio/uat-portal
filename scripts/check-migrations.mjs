// CI guard for supabase/migrations: sequential unique numbers, and no seed data in schema files.
// Legacy files that already contain seeds are listed in LEGACY_SEEDS (see docs/deployment.md);
// don't add to it, put new seed data in supabase/seed.*.sql instead.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = join(resolve(import.meta.dirname, ".."), "supabase", "migrations");
// The 0000 baseline files only match because handle_new_user() inserts into profiles (a trigger function, not seed data).
const LEGACY_SEEDS = new Set(["0000_baseline_core.sql", "0000b_baseline_iterations.sql", "0003_organizations.sql", "0010_lockdown_grants.sql"]);
const SEED_PATTERNS = [/insert\s+into\s+(public\.)?profiles/i, /insert\s+into\s+auth\.users/i, /@(example|acme|whitecloak)\./i];

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const errors = [];
const seen = new Map();

for (const f of files) {
    const m = f.match(/^(\d{4})([a-z]?)_[a-z0-9_]+\.sql$/);
    if (!m) {
        errors.push(`${f}: name must look like 0073_short_name.sql`);
        continue;
    }
    const key = m[1] + m[2];
    if (seen.has(key)) errors.push(`${f}: number ${key} already used by ${seen.get(key)}`);
    seen.set(key, f);

    if (LEGACY_SEEDS.has(f)) continue;
    const sql = readFileSync(join(dir, f), "utf8");
    for (const p of SEED_PATTERNS) {
        if (p.test(sql)) errors.push(`${f}: looks like seed/test data (${p}); move it to supabase/seed.*.sql`);
    }
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}
console.log(`${files.length} migration files OK`);
