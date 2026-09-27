"use client";

import { createContext, useContext } from "react";
import type { currentUser } from "@/lib/supabase/auth";

const CurrentUserContext = createContext<currentUser | null>(null);

// Seeded once by the root layout from getCurrentUser().
export function CurrentUserProvider({ user, children }: { user: currentUser; children: React.ReactNode }) {
	return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
	return useContext(CurrentUserContext);
}
