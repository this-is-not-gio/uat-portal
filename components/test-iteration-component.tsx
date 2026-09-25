import { ClipboardIcon, IterationCw } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getIterationsBySuiteId } from "@/lib/supabase/test-iterations";
import { TestIterationsTable } from "@/components/test-iterations-table";

export async function TestIterationComponent({ testSuiteId, suiteName }: { testSuiteId: string; suiteName: string }) {
	const iterations = await getIterationsBySuiteId(testSuiteId);

	if (iterations.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-12">
				<div className="justify-center bg-muted/50 rounded-xl size-20 flex flex-col items-center gap-2">
					<IterationCw size={45} className="text-muted-foreground" />
				</div>
				<div className="flex flex-col items-center justify-center gap-1">
					<p className="font-semibold text-muted-foreground text-lg">No test iterations yet</p>
					<p className="text-xs text-muted-foreground">Test iterations will appear here once testing starts.</p>
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
					<div className="flex flex-row items-center gap-2">
						<ClipboardIcon size={16} />
						<p className="flex flex-row items-center gap-2 font-medium">Test Iterations</p>
						<Badge variant="secondary" className="text-xs">{iterations.length} Iterations</Badge>
					</div>
				</div>
				<TestIterationsTable iterations={iterations} />
			</div>
		</ScrollArea>
	);
}
