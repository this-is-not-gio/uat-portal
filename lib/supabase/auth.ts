import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { Database } from "./database.types";

export type currentUser = {
    id: string;
    email: string | null;
    fullName: string;
    role: Database["public"]["Enums"]["user_role"];
    // Null only for a profile not yet assigned to an org (e.g. a user created without metadata).
    organization: {
        id: string;
        name: string;
        type: Database["public"]["Enums"]["org_type"];
    } | null;
};

// One lookup per request, shared by the layout, pages and server actions.
export const getCurrentUser = cache(async (): Promise<currentUser | null> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
        .from("profiles")
        // Many-to-one embed: organization comes back as one object (or null), not an array.
        .select("full_name, role, organization:organizations(id, name, type)")
        .eq("id", user.id)
        .single();
    if (error) {
        console.error("Failed to load profile:", error.message);
        return null;
    }

    return {
        id: user.id, email: user.email ?? null, fullName: profile.full_name, role: profile.role,
        organization: profile.organization,
    };
});

// For server actions: the proxy already gates pages, this covers direct action calls.
export async function requireUser(): Promise<currentUser> {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    return user;
}

// Only same-origin paths; "//host" would be read as protocol-relative.
export function safeRedirect(path: string | null | undefined, fallback = "/dashboard") {
    return path && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
