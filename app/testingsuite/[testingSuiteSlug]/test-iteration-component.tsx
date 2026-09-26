import { ClipboardIcon, ClipboardList, FolderClock, IterationCw } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIterationTestSections, getIterationTestCaseIds } from "@/lib/supabase/test-iterations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { getIterationScopeOptions } from "@/lib/supabase/iteration-actions";
import { format } from "date-fns";
import { IterationTestCaseList } from "./components/iteration-test-case-list";
import AddTestCasesControl, { type addableSection } from "./components/add-test-cases-control";

export async function TestIterationComponent({ testSuiteId, suiteName, iteration }: { testSuiteId: string; suiteName: string; iteration: testIteration | null }): Promise<import("react").JSX.Element> {
	const sections = iteration ? await getIterationTestSections(iteration.id) : [];
	const allTestCases = sections ? sections.flatMap((section) => section.testCases).filter((tc) => tc.includedInRun) : [];

	// Only a running round can actually take more test cases (apply_iteration_sync enforces this too).
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

	if(allTestCases.length === 0) {
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
					{iteration?.status === "in_progress" && <AddTestCasesControl iterationId={iteration.id} sections={addableSections} />}
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
					{iteration?.status === "in_progress" && <AddTestCasesControl iterationId={iteration.id} sections={addableSections} />}
				</div>
				<IterationTestCaseList testCases={allTestCases} iteration={iteration} />
			</div>
		</ScrollArea>
	);
}
