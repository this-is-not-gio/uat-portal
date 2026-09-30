"use client";

import { createContext, useContext } from "react";
import type { currentUser } from "@/lib/supabase/auth";
import { can, type permission } from "@/lib/auth/permissions";

const CurrentUserContext = createContext<currentUser | null>(null);

// Seeded once by the root layout from getCurrentUser().
export function CurrentUserProvider({ user, children }: { user: currentUser; children: React.ReactNode }) {
	return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
	return useContext(CurrentUserContext);
}

// For hiding/disabling controls: `const canAuthor = useCan("author")`. The server still re-checks.
export function useCan(permission: permission) {
	return can(useCurrentUser(), permission);
}
