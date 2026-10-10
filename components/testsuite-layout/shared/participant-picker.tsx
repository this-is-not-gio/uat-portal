import type { orgType } from "@/lib/supabase/organizations";

export const ORG_TYPE_LABELS: Record<orgType, string> = {
	vendor: "Development Team",
	client: "Client",
	external: "External company",
};
