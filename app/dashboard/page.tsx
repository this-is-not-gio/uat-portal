import { requireUser } from "@/lib/supabase/auth";
import { getSidebarSuites } from "@/lib/supabase/Init";
import { ClipboardPen, TestTubeDiagonal } from "lucide-react";
import ContinueTestingTables from "./continue-testing-tables";

export default async function DashboardPage() {
	const user = await requireUser();
	// Same cached call as the sidebar in app/layout.tsx, so no extra round trip.
	const testingSuites = await getSidebarSuites(user);

	return (
		<div className="flex flex-col px-4">
			<div className="">
				<div className="flex flex-row items-center gap-2">
					<TestTubeDiagonal className="h-6 w-6" />
					<h1 className="text-2xl font-bold tracking-tight">Hello,Tester!</h1>
				</div>
				<p className="text-muted-foreground mt-2 text-xs">
					Here you can manage your testing suites, view test cases, and track test results.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
				<div className="w-full border rounded-md">
					<div className="bg-gray-200/10 p-3 flex flex-row gap-2 items-center">
						<div className="p-3 bg-gray-500/10 rounded-md w-fit h-fit">
							<ClipboardPen className="size-5" />
						</div>
						<div className="">
							<h2 className="text-sm font-semibold">Continue Testing</h2>
							<p className="text-xs text-muted-foreground">
								Manage and organize your test cases for efficient testing.
							</p>
						</div>
					</div>
					<ContinueTestingTables testingSuites={testingSuites} />
				</div>
			</div>
		</div>
	);
}
