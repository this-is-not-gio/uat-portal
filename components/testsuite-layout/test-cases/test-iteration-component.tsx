import { TestCasesSidebarTrigger } from "./test-cases-sidebar";
import Link from "next/link";
import { Badge, ChartColumn, ClipboardIcon, FolderClock, IterationCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIterationTestSections, getIterationTestCaseIds, getIterationParticipants } from "@/lib/supabase/test-iterations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { getIterationScopeOptions } from "@/lib/supabase/iteration-actions";
import { getTesterCountsByOrg } from "@/lib/supabase/organizations";
import { format } from "date-fns";
import { IterationTestCaseList } from "./iteration-test-case-list";
import type { notIncludedSection } from "./section-dialog";
import AddTestCasesControl, { type addableSection } from "./add-test-cases-control";
import IterationHeaderMenu from "./iteration-header-menu";
import AddParticipantButton from "./add-participant-button";
import { CompleteIterationButton, ResetIterationButton, StartIterationButton, StopIterationButton } from "@/components/testsuite-layout/shared/iteration-actions";
import { unsubmittedParticipantOrgs } from "@/lib/supabase/overview";
import { testResultsHref } from "@/components/testsuite-layout/test-results/href";
export async function TestIterationComponent({ testSuiteId, testSuiteSlug, suiteName, iteration, sectionsNotIncluded }: {
	testSuiteId: string;
	testSuiteSlug: string;
	suiteName: string;
	iteration: testIteration | null;
	// Set only while the round is planned/running — enables its Add Section/Add Participant buttons.
	sectionsNotIncluded?: notIncludedSection[];
}): Promise<import("react").JSX.Element> {
	const [sections, participants, testerCounts] = iteration
		? await Promise.all([getIterationTestSections(iteration.id), getIterationParticipants(iteration.id), getTesterCountsByOrg()])
		: [[], [], {}];
	// Every result row (excluded ones included) so the table can show what's left out.
	const allRows = sections.flatMap((section) => section.testCases);
	const allTestCases = allRows.filter((tc) => tc.includedInRun);
	// Rows are one per case per org, so count distinct cases. No sections means none.
	const plannedCaseCount = new Set(allTestCases.map((tc) => tc.testCaseId ?? tc.id)).size;

	// Note: a running round can no longer take more test cases (0023 locks its case set), so
	// AddTestCasesControl stays unused; this list currently only feeds the header buttons' disabled state.
	let addableSections: addableSection[] = [];
	if (iteration?.status === "in_progress") {
		const [scope, existingIds] = await Promise.all([
			getIterationScopeOptions({ suiteId: testSuiteId }),
			getIterationTestCaseIds(iteration.id),
		]);
		if (scope.ok) {
			addableSections = scope.data.sections.map((section) => ({
				...section,
				testCases: section.testCases.map((tc) => ({ ...tc, alreadyIncluded: existingIds.has(tc.id) })),
			}));
		}
	}

	return (
		<ScrollArea className="flex-1 shrink-0 flex flex-col px-2">
			<div className="min-h-full p-4 flex flex-col gap-4">
				<div className="">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">Test Suite</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">{suiteName}</p>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="bg-gray-50/30 px-4 py-3 border rounded-md flex flex-col md:flex-row md:items-center md:justify-between gap-2">
					<div className="flex flex-row items-center gap-1">
						<TestCasesSidebarTrigger />
						<div className="size-9 hidden lg:flex flex-row items-center justify-center">
							<FolderClock />
						</div>
						<div className="">
							<p className="flex flex-row items-center gap-2 font-medium text-xs">{iteration?.name}</p>
							<p className="text-xs text-muted-foreground font-mono">{format(iteration?.startedAt || new Date(), "MMMM dd yyyy")} to {format(iteration?.plannedEndDate || new Date(), "MMMM dd yyyy")}</p>
						</div>
						{/* <Badge variant="secondary" className="text-xs">{section?.testCases.length} Test Cases</Badge> */}
					</div>
					<div className="flex flex-row items-center gap-1 justify-between w-full md:w-fit">
						{/* sectionsNotIncluded is only set for an editable planned/running round. */}
						{iteration?.status === "not_started" ?
							<div className="flex flex-row items-center gap-1">
								<StartIterationButton
									iteration={iteration}
									participantCount={participants.length}
									testCaseCount={plannedCaseCount}
									// Nothing to run yet: Start stays disabled until the round has participants and test cases.
									disabledReason={
										participants.length === 0 && plannedCaseCount === 0 ? "Add participants and test cases first."
											: participants.length === 0 ? "Add at least one participant first."
												: plannedCaseCount === 0 ? "Add at least one test case first."
													: undefined
									}
								/>
							</div>
							: iteration?.status === "in_progress" ?
								<div className="flex flex-row items-center gap-1 w-full md:w-fit">
									<StopIterationButton iteration={iteration} />
									<CompleteIterationButton
										iteration={iteration}
										untestedCount={allTestCases.filter((tc) => tc.status === "Untested" || tc.status === "In Progress").length}
										unsubmittedOrgs={unsubmittedParticipantOrgs(participants)}
									/>
								</div>
								: iteration?.status === "completed" ?
									// A finished round has nothing left to run: point to its results instead.
									<Button nativeButton={false} render={<Link href={testResultsHref(testSuiteSlug, "all", { iteration: iteration.iterationNumber })} />}>
										<ChartColumn size={16} />
										<p className="text-xs">View Results</p>
									</Button>
									: iteration?.status === "stopped" ?
										<div className="flex flex-row items-center gap-1">
											<ResetIterationButton
												iteration={iteration}
												hasRecordedResults={allTestCases.some((tc) => tc.status !== "Untested")}
											/>
										</div>
										: null
						}
						{/* A completed round is read-only history: nothing left to edit. */}
						{iteration && iteration.status !== "completed" && <IterationHeaderMenu iteration={iteration} />}
					</div>
				</div>
				<IterationTestCaseList
					testCases={allRows}
					iteration={iteration}
					roundActions={sectionsNotIncluded ? { suiteId: testSuiteId, testSuiteSlug, sectionsNotIncluded } : undefined}
					participants={participants}
					testerCounts={testerCounts}				/>
			</div>
		</ScrollArea>
	);
}
