import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Remarks posted with evidence links carry this heading (see RemarkMarkdownField).
const EVIDENCE_MARKER = /\*\*Evidence:\*\*/;

// The user's own failed steps (and cases marked Failed by hand with no failed step) that have no
// remark of theirs carrying evidence: an uploaded file or an evidence link. Labels like "TC-1 (step 2)".
// Returns null when a query fails, so callers decide whether to block or stay quiet.
export async function failedWithoutEvidence(supabase: SupabaseClient<Database>, iterationId: string, userId: string): Promise<string[] | null> {
	const { data: cases, error: casesError } = await supabase
		.from("test_case_results")
		.select("id, code, title, status")
		.eq("iteration_id", iterationId)
		.eq("tester_id", userId)
		.eq("included_in_run", true);
	if (casesError) return null;
	const caseIds = (cases ?? []).map((c) => c.id);
	if (caseIds.length === 0) return [];

	const { data: steps, error: stepsError } = await supabase
		.from("test_step_results")
		.select("id, order_index, status, test_case_result_id")
		.in("test_case_result_id", caseIds);
	if (stepsError) return null;

	const stepsByCase = new Map<string, NonNullable<typeof steps>>();
	for (const step of steps ?? []) stepsByCase.set(step.test_case_result_id, [...(stepsByCase.get(step.test_case_result_id) ?? []), step]);
	// Only cases that failed somewhere matter; their steps' remarks are what we need to look at.
	const relevant = (cases ?? []).filter((c) => c.status === "Failed" || (stepsByCase.get(c.id) ?? []).some((s) => s.status === "Failed"));
	const stepIds = relevant.flatMap((c) => (stepsByCase.get(c.id) ?? []).map((s) => s.id));
	if (stepIds.length === 0) return [];

	const { data: remarks, error: remarksError } = await supabase
		.from("test_remarks")
		.select("id, remark, test_step_result_id")
		.eq("created_by", userId)
		.in("test_step_result_id", stepIds);
	if (remarksError) return null;
	const remarkIds = (remarks ?? []).map((r) => r.id);
	const withFiles = new Set<string>();
	if (remarkIds.length > 0) {
		const { data: files, error: filesError } = await supabase.from("attachments").select("remark_id").in("remark_id", remarkIds);
		if (filesError) return null;
		for (const f of files ?? []) if (f.remark_id) withFiles.add(f.remark_id);
	}
	const evidenceSteps = new Set<string>();
	for (const r of remarks ?? []) {
		if (r.test_step_result_id && (withFiles.has(r.id) || EVIDENCE_MARKER.test(r.remark))) evidenceSteps.add(r.test_step_result_id);
	}

	const missing: string[] = [];
	for (const c of relevant) {
		const caseSteps = [...(stepsByCase.get(c.id) ?? [])].sort((x, y) => x.order_index - y.order_index);
		const label = c.code ?? c.title;
		const failedSteps = caseSteps.filter((s) => s.status === "Failed");
		if (failedSteps.length === 0) {
			if (!caseSteps.some((s) => evidenceSteps.has(s.id))) missing.push(label);
			continue;
		}
		for (const step of failedSteps) {
			if (!evidenceSteps.has(step.id)) missing.push(`${label} (step ${caseSteps.indexOf(step) + 1})`);
		}
	}
	return missing;
}
