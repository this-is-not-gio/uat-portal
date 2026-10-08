import { REPORT_SECTIONS, reportPages, SignOffReportView } from "@/components/sign-off-report/sign-off-report-view";
import { SignOffPicker } from "@/components/sign-off-report/sign-off-picker";
import { PrintButton } from "@/components/sign-off-report/print-button";
import { buildSignOffReport, getSignOffReport, type FrozenSignOffReport } from "@/lib/supabase/sign-off-report";
import { getTestSuiteBySlug } from "@/lib/supabase/test-suite";
import { IssueReportButton } from "./issue-report-button";
import { SignOffDocument } from "./sign-off-document";
import { SignOffNotice } from "./sign-off-notice";
import { SignOffInfo } from "./sign-off-info";
import { signOffStatusOf } from "./sign-off-status-badge";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { signOff, signOffDraft } from "@/lib/supabase/overview";
import { getSuiteEndpoints, getSuiteOverviewSections, getSuiteTestAccounts } from "@/lib/supabase/test-accounts";
import { overviewTemplates, type OverviewTemplate } from "@/lib/report/report-details";

// Sign-off tab (Admin and Internal): the frozen report inline, with a picker for earlier or
// withdrawn sign-offs. Download PDF prints this page; @media print in globals.css drops the app and suite chrome.
// The suite layout's ScrollArea scrolls it, so there's no scroll container here.
// selectedId is null when the vendor's draft (For Sign-off) is open; it has no frozen report yet.
export default async function SignOffTab({ suiteId, suiteSlug, signOffs, selectedId, draft }: { suiteId: string; suiteSlug: string; signOffs: signOff[]; selectedId: string | null; draft: signOffDraft | null }) {
	const frozen = selectedId ? await getSignOffReport({ suiteSlug, signOffId: selectedId }) : draft ? await draftPreview(suiteSlug, draft) : null;
	const isDraft = !selectedId && !!draft;
	const templates = isDraft ? await draftTemplates(suiteId, suiteSlug) : [];
	// The vendor (Admin) sent it, so an issued one reads "issued"; for the client it's "awaiting your sign-off".
	const currentUser = await getCurrentUser();
	const selected = signOffs.find((s) => s.id === selectedId);
	const status = isDraft || !selected ? "drafting" : signOffStatusOf(selected, currentUser?.role === "Admin" ? "vendor" : "client");

	return (
		<SignOffDocument
			pages={frozen ? reportPages(frozen, { draft: isDraft, templates }) : []}
			sections={frozen ? REPORT_SECTIONS : []}
			versions={<SignOffPicker suiteSlug={suiteSlug} signOffs={signOffs} selectedId={selectedId} hasDraft={!!draft} />}
			issueAction={isDraft && draft ? <IssueReportButton suiteId={suiteId} draft={draft} /> : undefined}
			notice={frozen ? <SignOffNotice frozen={frozen} draft={isDraft} /> : undefined}
			info={<SignOffInfo status={status} frozen={frozen} isDraft={isDraft} />}
		/>
	);
}

// Overview content the draft's Add section menu can copy into Report details.
async function draftTemplates(suiteId: string, suiteSlug: string): Promise<OverviewTemplate[]> {
	const [testSuite, testAccounts, endpoints, sections] = await Promise.all([
		getTestSuiteBySlug(suiteSlug),
		getSuiteTestAccounts(suiteId),
		getSuiteEndpoints(suiteId),
		getSuiteOverviewSections(suiteId),
	]);
	return overviewTemplates({ description: testSuite?.description ?? null, testAccounts, endpoints, sections });
}

// The draft has no frozen report yet, so preview it from live data (as the issue dialog does).
// issueSignOff rebuilds and freezes it on issue, so this copy is display-only.
async function draftPreview(suiteSlug: string, draft: signOffDraft): Promise<FrozenSignOffReport | null> {
	const testSuite = await getTestSuiteBySlug(suiteSlug);
	if (!testSuite) return null;
	try {
		const report = await buildSignOffReport(testSuite.id);
		report.sections = draft.sections;
		return {
			signOffId: draft.id,
			iterationName: report.header.roundName ?? "",
			signedOffBy: null,
			signedOffAt: report.header.generatedAt,
			note: draft.note || null,
			acknowledgedAt: null,
			acknowledgedBy: null,
			revokedAt: null,
			rejectedAt: null,
			rejectedBy: null,
			rejectionReason: null,
			report,
		};
	} catch {
		return null;
	}
}
