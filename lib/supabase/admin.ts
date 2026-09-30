import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client: skips RLS and can manage auth users. Only for admin actions,
// and only after can(user, "admin_area"). The "server-only" import makes the build fail
// if a Client Component ever imports this, so the key can't reach the browser.
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (see .env.local).");
    return createClient<Database>(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
