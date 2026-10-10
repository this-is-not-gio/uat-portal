import type { roundCoverage } from "@/lib/supabase/test-iterations";

// Why Start is blocked, in the order staff should fix it. Mirrors begin_iteration's checks (0058).
export function coverageBlockers(coverage: roundCoverage): string[] {
	const blockers: string[] = [];
	if (coverage.casesWithoutRole.length > 0) {
		const n = coverage.casesWithoutRole.length;
		blockers.push(`${n} test ${n === 1 ? "case has" : "cases have"} no test role.`);
	}
	for (const role of coverage.rolesWithoutTesters) {
		const nobody = coverage.rolesWithoutUsers.some((r) => r.testRoleId === role.testRoleId);
		blockers.push(nobody ? `No user holds ${role.name}.` : `No tester is ticked for ${role.name}.`);
	}
	return blockers;
}
