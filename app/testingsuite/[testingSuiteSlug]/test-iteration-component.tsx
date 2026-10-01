import { Badge, ClipboardIcon, FolderClock, IterationCw, MoreHorizontal } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIterationTestSections, getIterationTestCaseIds, getIterationParticipants } from "@/lib/supabase/test-iterations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { getIterationScopeOptions } from "@/lib/supabase/iteration-actions";
import { getTesterCountsByOrg } from "@/lib/supabase/organizations";
import { format } from "date-fns";
import { IterationTestCaseList } from "./components/iteration-test-case-list";
import type { notIncludedSection } from "./components/section-dialog";
import AddTestCasesControl, { type addableSection } from "./components/add-test-cases-control";
import IterationHeaderMenu from "./components/iteration-header-menu";
import { CompleteIterationButton, ResetIterationButton, StartIterationButton, StopIterationButton } from "./components/iteration-actions";
import { unsubmittedParticipantOrgs } from "@/lib/supabase/overview";

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
				<div className="bg-gray-50/30 px-4 py-3 border rounded-md flex flex-row items-center justify-between">
					<div className="flex flex-row items-center gap-1">
						<div className="size-9 flex flex-row items-center justify-center">
							<FolderClock />
						</div>
						<div className="">
							<p className="flex flex-row items-center gap-2 font-medium text-xs">{iteration?.name}</p>
							<p className="text-xs text-muted-foreground font-mono">{format(iteration?.startedAt || new Date(), "MMMM dd yyyy")} to {format(iteration?.plannedEndDate || new Date(), "MMMM dd yyyy")}</p>
						</div>
						{/* <Badge variant="secondary" className="text-xs">{section?.testCases.length} Test Cases</Badge> */}
					</div>
					<div className="">
						{iteration?.status === "not_started" ?
							<div className="flex flex-row items-center gap-1">
								<StartIterationButton
									iteration={iteration}
									participantCount={participants.length}
									// Rows are one per case per org, so count distinct cases.
									testCaseCount={new Set(allTestCases.map((tc) => tc.testCaseId ?? tc.id)).size}
								/>
								<IterationHeaderMenu iteration={iteration} />
							</div>
							: iteration?.status === "in_progress" ?
								<div className="flex flex-row items-center gap-1">
									<StopIterationButton iteration={iteration} />
									<CompleteIterationButton
										iteration={iteration}
										untestedCount={allTestCases.filter((tc) => tc.status === "Untested" || tc.status === "In Progress").length}
										unsubmittedOrgs={unsubmittedParticipantOrgs(participants)}
									/>
									<IterationHeaderMenu iteration={iteration} />
								</div>
								: iteration?.status === "completed" ?
									<></>
									: iteration?.status === "stopped" ?
										<div className="flex flex-row items-center gap-1">
											<ResetIterationButton
												iteration={iteration}
												hasRecordedResults={allTestCases.some((tc) => tc.status !== "Untested")}
											/>
										</div>
										: null
						}
						{/* <div className="flex flex-row items-center gap-2">
							<Button size="lg" className="text-xs" disabled={addableSections.length === 0}>
								<Play size={14} />
								<span>Start Iteration</span>
							</Button>
						</div> */}
					</div>
				</div>
				<IterationTestCaseList
					testCases={allRows}
					iteration={iteration}
					roundActions={sectionsNotIncluded ? { suiteId: testSuiteId, testSuiteSlug, sectionsNotIncluded } : undefined}
					participants={participants}
					testerCounts={testerCounts}
				/>
			</div>
		</ScrollArea>
	);
}
