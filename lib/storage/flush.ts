import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import * as storage from "./b2";

const BATCH = 100;

// Removes queued objects (storage_deletions, filled by a trigger on attachments) from the bucket,
// then dequeues exactly the ones that were removed. Best effort: it never throws, and a key whose
// bucket delete failed stays queued for the next flush. Returns how many keys it removed.
export async function flushStorageDeletions(supabase: SupabaseClient<Database>, { maxBatches = 1 }: { maxBatches?: number } = {}): Promise<number> {
    let removed = 0;
    try {
        for (let i = 0; i < maxBatches; i++) {
            const { data: keys, error } = await supabase.rpc("pending_storage_deletions", { p_limit: BATCH });
            if (error || !keys || keys.length === 0) break;
            const results = await Promise.allSettled(keys.map((key) => storage.remove(key)));
            const done = keys.filter((_, n) => results[n].status === "fulfilled");
            results.forEach((r, n) => { if (r.status === "rejected") console.error("Storage delete failed:", keys[n], (r.reason as Error).message); });
            if (done.length === 0) break;
            const { error: clearError } = await supabase.rpc("complete_storage_deletions", { p_keys: done });
            if (clearError) { console.error("Dequeue failed:", clearError.message); break; }
            removed += done.length;
            if (keys.length < BATCH) break;
        }
    } catch (e) {
        console.error("Storage flush failed:", (e as Error).message);
    }
    return removed;
}
