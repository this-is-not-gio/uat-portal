"use client";

import { createContext, useContext } from "react";
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import type { testRoleOptions } from "@/lib/supabase/organizations";
import { sameRoleName } from "@/lib/auth/test-role";

const EMPTY: testRoleOptions = { internal: [], external: [] };

const TestRoleOptionsContext = createContext<testRoleOptions>(EMPTY);

// The test roles created in /admin (Internal + External), loaded once by the Test Cases
// layout for the test case editor and the import's Assigned Role matching.
export function TestRoleOptionsProvider({ options, children }: { options: testRoleOptions; children: React.ReactNode }) {
	return <TestRoleOptionsContext.Provider value={options}>{children}</TestRoleOptionsContext.Provider>;
}

export function useTestRoleOptions() {
	return useContext(TestRoleOptionsContext);
}

// Select items for a role picker: Internal and External groups, plus the current value
// under "Not in roles" when it no longer matches one (renamed/deleted in /admin).
export function RoleOptionGroups({ options, current }: { options: testRoleOptions; current: string | null }) {
	const known = [...options.internal, ...options.external];
	const groups = [
		{ label: "Internal", roles: options.internal },
		{ label: "External", roles: options.external },
		{ label: "Not in roles", roles: current && !known.some((r) => sameRoleName(r, current)) ? [current] : [] },
	].filter((g) => g.roles.length > 0);
	if (groups.length === 0) return <p className="px-2 py-1.5 text-xs text-muted-foreground">No test roles yet. Add them in Admin → Roles.</p>;
	return groups.map((group, i) => (
		<SelectGroup key={group.label}>
			{i > 0 && <SelectSeparator />}
			<SelectLabel>{group.label}</SelectLabel>
			{group.roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
		</SelectGroup>
	));
}
