import type { orgType } from "@/lib/supabase/organizations";

// Admin-facing names for org types ("client" is the Internal org). Kept out of
// organizations.ts so client components can import it without the server client.
export const ORG_TYPE_LABELS: Record<orgType, string> = { vendor: "Development Team", client: "Internal", external: "External" };
