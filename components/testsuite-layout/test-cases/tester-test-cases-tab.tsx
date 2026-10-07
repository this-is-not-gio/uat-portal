import TestCasesSidebar from "./test-cases-sidebar";
import { testCasesHref } from "./href";
import Link from "next/link";
import { ChevronRight, Clipboard, ClipboardList, File, FolderClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { getIterationParticipants, getIterationResults, getIterationsBySuiteId, getSectionsByIteration, type testIteration } from "@/lib/supabase/test-iterations";
import { canWithdrawParticipation, getParticipationProgress } from "@/lib/supabase/overview";
import type { currentUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/permissions";
import type { suiteStatus } from "@/lib/supabase/Init";
import ResultOrgPicker from "./result-org-picker";
import TesterTestCasesComponents from "./tester-test-cases-components";
import { isRemovedFromRound, ROUND_STATUS_LABELS } from "@/lib/supabase/case-states";

// Internal/External "Test Cases": the viewer's own round rows (test_case_results), never the
// live template. Everything here — rounds, sections, counts — comes from the lens org's rows.
export default async function TesterTestCasesTab({
	testSuiteId,
	testSuiteSlug,
	suiteName,
	suiteStatus,
	sectionSlug,
	iterationNumber,
	orgId,
	currentUser,
}: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteName: string;
	suiteStatus: suiteStatus;
	sectionSlug?: string;
	iterationNumber?: string;
	// ?org= lens (Internal only); External always sees its own org.
	orgId?: string;
	currentUser: currentUser;
}) {
	const ownOrgId = currentUser.organization?.id;
	const allIterations = ownOrgId ? await getIterationsBySuiteId(testSuiteId) : [];
	// Internal can read every round (staff RLS), so keep only the ones the viewer's org takes part in.
	const participantsByIteration = await Promise.all(allIterations.map((iteration) => getIterationParticipants(iteration.id)));
	const iterations = allIterations.filter((_, index) => participantsByIteration[index].some((p) => p.organization.id === ownOrgId));
	// Rounds the viewer's org already submitted; their sidebar badge reads "Submitted" instead of "In progress".
	const ownSubmittedIterationIds = new Set(
		allIterations.filter((_, index) => participantsByIteration[index].some((p) => p.organization.id === ownOrgId && p.submittedAt)).map((iteration) => iteration.id)
	);

	if (!ownOrgId || iterations.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<ClipboardList size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">No testing assigned yet</p>
					<p className="text-xs text-muted-foreground">Test cases show up here once your organization is added to a testing round.</p>
				</div>
			</div>
		);
	}

	// ?iteration=N only counts if it's one of the viewer's rounds; otherwise the open round,
	// then the latest one the org took part in (list is newest first).
	const selectedIteration =
		iterations.find((iteration) => String(iteration.iterationNumber) === iterationNumber) ??
		iterations.find((iteration) => iteration.status === "in_progress" || iteration.status === "not_started") ??
		iterations[0];

	// RLS gives External only its own participation row; Internal gets every org's.
	const participants = await getParticipationProgress(selectedIteration.id);
	const ownParticipation = participants.find((p) => p.organization.id === ownOrgId) ?? null;
	const lensOrgs = can(currentUser, "view_all_results") ? participants.map((p) => p.organization) : ownParticipation ? [ownParticipation.organization] : [];
	const lensOrg = lensOrgs.find((o) => o.id === orgId) ?? ownParticipation?.organization ?? lensOrgs[0];
	const isOwnLens = lensOrg?.id === ownOrgId;

	const isRunning = selectedIteration.status === "in_progress";
	const [rawResults, sectionsByIteration] = await Promise.all([
		getIterationResults(selectedIteration.id, lensOrg?.id),
		// Own-org sections for every round, so template-only (e.g. internal) section names never leak.
		getSectionsByIteration(testSuiteId, ownOrgId),
	]);
	// Testers only see what the round runs; cases unticked while it was planned stay out.
	// No live-template diff here: edits reach testers only once the vendor syncs them (syncKind).
	// Rows removed mid-round stay listed, flagged and view only (0036).
	const results = rawResults.filter((row) => row.includedInRun || isRemovedFromRound(row));

	const isOwnOrgSubmitted = isOwnLens && !!ownParticipation?.submittedAt;
	const suiteIsOpen = suiteStatus === "in_testing";
	const canExecute = isRunning && suiteIsOpen && isOwnLens && !isOwnOrgSubmitted && can(currentUser, "execute");
	// Remarks outlive the lock (0020): submitted or closed rounds still take remarks on own-org rows.
	const canRemark = selectedIteration.status !== "not_started" && isOwnLens && can(currentUser, "execute");
	// Only while the round runs (it carries Withdraw); once it ends, the notice shows the submission date.
	const showSubmission = isRunning && isOwnLens && !!ownParticipation && can(currentUser, "submit");
	// Until an Admin/Internal user completes or stops the round (0019).
	const canWithdraw = isOwnOrgSubmitted && can(currentUser, "submit") && await canWithdrawParticipation(selectedIteration.id);
	// When the lens org submitted, for the notice.
	const lensSubmittedAt = participants.find((p) => p.organization.id === lensOrg?.id)?.submittedAt ?? null;

	// The lens org's sections for the selected round; other rounds list the viewer's own.
	const selectedSections = [...new Map(results.filter((row) => row.sectionSlug).map((row) => [row.sectionSlug as string, row.sectionName ?? (row.sectionSlug as string)])).entries()];
	const isAllSections = !sectionSlug || sectionSlug === "all" || !selectedSections.some(([slug]) => slug === sectionSlug);
	const visibleResults = isAllSections ? results : results.filter((row) => row.sectionSlug === sectionSlug);
	const sectionName = isAllSections ? selectedIteration.name || "All sections" : selectedSections.find(([slug]) => slug === sectionSlug)?.[1] ?? sectionSlug ?? "";

	const hrefFor = (iteration: testIteration, section: string) => {
		const params = new URLSearchParams({ iteration: String(iteration.iterationNumber) });
		if (lensOrg && !isOwnLens) params.set("org", lensOrg.id);
		return `${testCasesHref(testSuiteSlug, section)}?${params.toString()}`;
	};
	const isTested = (status: string) => status !== "Untested" && status !== "In Progress";

	return (
		<>
			<TestCasesSidebar label="Iterations" sidebar={<>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Testing Iterations</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{/* Latest round first, as the query returns them. */}
								{iterations.map((iteration) => {
									const isSelected = iteration.id === selectedIteration.id;
									const sections: { slug: string; name: string; tested?: number; total?: number }[] = isSelected
										? selectedSections.map(([slug, name]) => {
											const rows = results.filter((row) => row.sectionSlug === slug && !isRemovedFromRound(row));
											return { slug, name, tested: rows.filter((row) => isTested(row.status)).length, total: rows.length };
										})
										: (sectionsByIteration.get(iteration.id) ?? []).filter((section) => section.includedCount > 0).map((section) => ({ slug: section.slug, name: section.name }));
									return (
										<SidebarMenuItem key={iteration.id}>
											{/* Keyed on selection so a newly selected round remounts open; the running round starts open too. */}
											<Collapsible
												key={`${iteration.id}:${isSelected}`}
												className="w-full"
												defaultOpen={isSelected || iteration.status === "in_progress"}
											>
												<div className="flex flex-row items-center">
													<CollapsibleTrigger render={
														<Button variant="ghost" size="icon" className="size-6 shrink-0 group/collapsible">
															<ChevronRight className="transition-transform group-data-[panel-open]/collapsible:rotate-90" />
														</Button>
													} />
													{/* The round row itself lists every test case in the round (no separate "All Test Cases" row). */}
													<SidebarMenuButton isActive={isSelected && isAllSections} render={<Link href={hrefFor(iteration, "all")} />}>
														<FolderClock />
														<span className="truncate">{iteration.name}</span>
														{iteration.status === "in_progress" && ownSubmittedIterationIds.has(iteration.id) ? (
											<Badge variant="outline" className="text-xs ml-auto border-green-800/30 bg-green-50 text-green-800">Submitted</Badge>
										) : (
											<Badge variant="secondary" className="text-xs ml-auto">{ROUND_STATUS_LABELS[iteration.status]}</Badge>
										)}
													</SidebarMenuButton>
												</div>
												<CollapsibleContent>
													<SidebarMenuSub className="ml-2.5">
														{sections.length > 0 && (
															<>
																{sections.map((section) => (
																	<SidebarMenuSubItem key={section.slug}>
																		<SidebarMenuSubButton isActive={isSelected && !isAllSections && sectionSlug === section.slug} render={<Link href={hrefFor(iteration, section.slug)} />}>
																			<Clipboard />
																			<span className="truncate text-xs">{section.name}</span>
																			{section.total !== undefined && (
																				<span className="ml-auto font-mono text-xs text-muted-foreground">{section.tested}/{section.total}</span>
																			)}
																		</SidebarMenuSubButton>
																	</SidebarMenuSubItem>
																))}
															</>
														)}
													</SidebarMenuSub>
												</CollapsibleContent>
											</Collapsible>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</>}>
			<TesterTestCasesComponents
				// Remount on round/section/lens switch so client state reseeds from the new rows.
				key={`${selectedIteration.id}:${selectedIteration.status}:${sectionSlug ?? "all"}:${lensOrg?.id ?? ""}`}
				suiteName={suiteName}
				iteration={selectedIteration}
				sectionName={sectionName}
				organizationName={lensOrg?.name ?? null}
				isOwnLens={isOwnLens}
				results={visibleResults}
				canExecute={canExecute}
				canRemark={canRemark}
				submittedAt={lensSubmittedAt}
				canWithdraw={canWithdraw}
				// Header's Submit Result: only while the own org can still submit. Untested cases span
				// the whole round, not just the visible section.
				submit={showSubmission && ownParticipation && !ownParticipation.submittedAt ? {
					organizationName: ownParticipation.organization.name,
					untestedCases: results
						.filter((row) => !isTested(row.status) && !isRemovedFromRound(row))
						.map((row) => ({ id: row.id, code: row.code ?? null, title: row.title, sectionName: row.sectionName })),
				} : null}
			/>
			</TestCasesSidebar>
		</>
	);
}
