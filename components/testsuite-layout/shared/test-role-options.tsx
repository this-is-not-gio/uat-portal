"use client";

import { createContext, useContext } from "react";
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import type { testRole, testRoleOptions } from "@/lib/supabase/organizations";

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

// The catalog roles from both groups, once each.
function allRoles(options: testRoleOptions): testRole[] {
	return [...new Map([...options.internal, ...options.external].map((r) => [r.id, r])).values()];
}

// The display name of a catalog role ID, or `fallback` (e.g. the name loaded with the record)
// when the role isn't among the options.
export function roleNameOf(options: testRoleOptions, id: string | null, fallback?: string | null): string | null {
	if (!id) return null;
	return allRoles(options).find((r) => r.id === id)?.name ?? fallback ?? null;
}

// Select items for a role picker (values are catalog role IDs): Internal and External groups,
// plus the current role under "No organization" when no org has it any more.
export function RoleOptionGroups({ options, current }: { options: testRoleOptions; current: testRole | null }) {
	const known = allRoles(options);
	const groups = [
		{ label: "Internal", roles: options.internal },
		{ label: "External", roles: options.external },
		{ label: "No organization", roles: current && !known.some((r) => r.id === current.id) ? [current] : [] },
	].filter((g) => g.roles.length > 0);
	if (groups.length === 0) return <p className="px-2 py-1.5 text-xs text-muted-foreground">No test roles yet. Add them in Admin → Roles.</p>;
	return groups.map((group, i) => (
		<SelectGroup key={group.label}>
			{i > 0 && <SelectSeparator />}
			<SelectLabel>{group.label}</SelectLabel>
			{group.roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
		</SelectGroup>
	));
}
