import { CalendarChevronsRight, ClipboardList, FolderClock, Lock } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIterationTestSections, getIterationParticipants } from "@/lib/supabase/test-iterations";
import { getTesterCountsByOrg } from "@/lib/supabase/organizations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { Button } from "@/components/ui/button";
import { IterationTestCaseList } from "./components/iteration-test-case-list";

// One section's view within a test iteration — the iteration-scoped
// counterpart of SectionContent/TestCasesComponents. Scaffolded to match
// TestIterationComponent's layout; refine as needed.
export async function TestIterationSection({
	suiteName,
	iteration,
	sectionSlug,
}: {
	suiteName: string;
	iteration: testIteration | null;
	sectionSlug?: string;
}): Promise<import("react").JSX.Element> {
	const [sections, participants, testerCounts] = iteration
		? await Promise.all([getIterationTestSections(iteration.id), getIterationParticipants(iteration.id), getTesterCountsByOrg()])
		: [[], [], {}];
	const section = sections.find((s) => s.slug === sectionSlug);
	const testCases = section?.testCases ?? [];

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
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">{iteration?.name}</p>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<p className="text-xs text-muted-foreground">{section?.name ?? sectionSlug}</p>
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
							<p className="flex flex-row items-center gap-2 font-medium text-xs">{section?.name ?? sectionSlug}</p>
							<p className="text-xs text-muted-foreground font-mono">{iteration?.name}</p>
						</div>
					</div>
					{/* Which cases a round runs is fixed once it starts (set_case_inclusion 0022, apply_iteration_sync 0023). */}
					{iteration && iteration.status !== "not_started" && (
						<div className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
							<Lock size={14} />
							<p>Test cases are locked for this round</p>
						</div>
					)}
					{/* <Button size="lg" className="text-xs">
						<CalendarChevronsRight size={16} className="mr-1" />
						Start Testing Iteration
					</Button> */}
				</div>
				{testCases.length === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="flex flex-col items-center justify-center gap-5 py-12">
							<div className="flex flex-col items-center justify-center text-center gap-5">
								<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
									<ClipboardList size={45} className="text-muted-foreground" />
								</div>
								<div className="flex flex-col items-center justify-center gap-1">
									<p className="font-semibold text-muted-foreground text-lg">No test cases yet</p>
									<p className="text-xs text-muted-foreground">This section has no test cases in {iteration?.name}.</p>
								</div>
							</div>
						</div>
					</div>
				) : (
					<IterationTestCaseList testCases={testCases} iteration={iteration} selectable={iteration?.status === "not_started"} sectionSlug={sectionSlug} participants={participants} testerCounts={testerCounts} />
				)}
			</div>
		</ScrollArea>
	);
}
