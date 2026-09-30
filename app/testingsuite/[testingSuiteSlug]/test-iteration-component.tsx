import { Badge, ClipboardIcon, ClipboardList, Flag, FolderClock, IterationCw, MoreHorizontal, Play, StopCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import IterationHeaderMenu from "./components/iteration-header-menu";
import { CompleteIterationButton } from "./components/iteration-actions";
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

	if (allTestCases.length === 0) {
		return (
			<div className="flex-1 p-4 flex flex-col gap-4">
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
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="flex flex-col items-center justify-center gap-5 py-12">
						<div className="flex flex-col items-center justify-center text-center gap-5">
							<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
								<ClipboardList size={45} className="text-muted-foreground" />
							</div>
							<div className="flex flex-col items-center justify-center gap-1">
								<p className="font-semibold text-muted-foreground text-lg">No test cases yet</p>
								<p className="text-xs text-muted-foreground">Test cases will appear here once they&apos;re added to {iteration?.name} iteration.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}


	return (
		<ScrollArea className="flex-1 shrink-0 flex flex-col px-2">
			<div className="flex-1 p-4 flex flex-col gap-4">
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
							</div>
							: iteration?.status === "in_progress" ?
								<div className="flex flex-row items-center gap-1">
									<Button size="lg" variant="outline" className="text-xs" disabled={addableSections.length === 0}>
										<StopCircle size={14} />
										<span>Stop Iteration</span>
									</Button>
									<CompleteIterationButton
										iteration={iteration}
										untestedCount={allTestCases.filter((tc) => tc.status === "Untested" || tc.status === "In Progress").length}
										unsubmittedOrgs={unsubmittedParticipantOrgs(participants)}
									/>
									<IterationHeaderMenu iteration={iteration} />
								</div>
								: iteration?.status === "completed" ?
									<></>
									: <div className="flex flex-row items-center gap-2">
										<Button size="lg" className="text-xs" disabled={addableSections.length === 0}>
											<Flag size={14} />
											<span>Complete Iteration</span>
										</Button>
									</div>
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
