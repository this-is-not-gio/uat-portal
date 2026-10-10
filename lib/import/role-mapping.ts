import { normalizeRoleName } from "@/lib/auth/test-role";
import type { testRole } from "@/lib/supabase/organizations";
import type { importCase } from "./parse-test-cases";

// One distinct role name from the import file that matches no catalog role.
// `key` is the normalized name, so "Aprover" and "aprover " share one entry
// (and one mapping); `name` is the first spelling in the file.
export type unmatchedRoleName = { key: string; name: string; caseCount: number };

// The author's choices in the review: normalized unmatched name → catalog role.
export type roleMappings = Record<string, testRole>;

// The distinct unmatched role names, in file order. Saving is blocked while any remain.
export function unmatchedRoleNames(cases: importCase[]): unmatchedRoleName[] {
	const names = new Map<string, unmatchedRoleName>();
	for (const testCase of cases) {
		if (!testCase.unmatchedRole) continue;
		const key = normalizeRoleName(testCase.unmatchedRole);
		const entry = names.get(key);
		if (entry) entry.caseCount++;
		else names.set(key, { key, name: testCase.unmatchedRole, caseCount: 1 });
	}
	return [...names.values()];
}

// Gives every case with a mapped unmatched name that catalog role. Unmapped names stay unmatched.
export function applyRoleMappings(cases: importCase[], mappings: roleMappings): importCase[] {
	return cases.map((testCase) => {
		const role = testCase.unmatchedRole ? mappings[normalizeRoleName(testCase.unmatchedRole)] : undefined;
		return role ? { ...testCase, testRoleId: role.id, roleAssignee: role.name, unmatchedRole: null } : testCase;
	});
}
