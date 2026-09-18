import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
	ClipboardList,
	LayoutDashboard,
	ListChecks,
	Activity,
	Paperclip,
} from "lucide-react";
import { EpicWorkspace } from "@/components/epic-workspace";
import { getEpicBySlug, getTestCasesByEpicId } from "@/lib/supabase/test-cases";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

function EpicPageSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-col gap-2 px-6 py-4">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-6 w-56" />
			</div>
			<div className="border-b w-full">
			</div>
			<div className="p-6">
				<Skeleton className="h-64 w-full" />
			</div>
		</div>
	);
}

async function EpicContent({ epicId }: { epicId: string }) {
	const epic = await getEpicBySlug(epicId);
	if (!epic) notFound();

	const testCases = await getTestCasesByEpicId(epic.id);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex flex-col gap-1 px-6 py-4">
				<p className="text-xs text-muted-foreground">EPIC</p>
				<h1 className="text-xl font-bold">{epic.name}</h1>
			</div>
			<div className="border-b w-full">
				<Tabs defaultValue="overview" className="w-full px-6">
					<TabsList variant="line">
						<TabsTrigger value="overview" className="w-full" disabled={testCases.length === 0}>
							<LayoutDashboard data-icon="inline-start" />
							Overview
						</TabsTrigger>
						<TabsTrigger value="test-cases" className="w-full" disabled={testCases.length === 0}>
							<ClipboardList data-icon="inline-start" />
							Test Cases
						</TabsTrigger>
						<TabsTrigger value="test-results" className="w-full" disabled={testCases.length === 0}>
							<ListChecks data-icon="inline-start" />
							Test Results
						</TabsTrigger>
						<TabsTrigger value="activity" className="w-full" disabled={testCases.length === 0}>
							<Activity data-icon="inline-start" />
							Activity
						</TabsTrigger>
						<TabsTrigger value="attachments" className="w-full" disabled={testCases.length === 0}>
							<Paperclip data-icon="inline-start" />
							Attachments
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			<div className="p-6 *:flex min-h-0 flex-1 flex-col gap-4 overflow-y-hidden">
				{
					testCases.length > 0 ?
					<div className="flex min-h-0 flex-1 flex-col">
						<EpicWorkspace initialTestCases={testCases} />
					</div>
					:
					<div className="w-full h-full flex items-center justify-center">
						<div className="flex max-w-sm flex-col items-center gap-4 text-center">
							<div className="flex size-25 items-center justify-center rounded-xl bg-muted">
								<ClipboardList className="size-14 text-muted-foreground" />
							</div>
							<div className="flex flex-col gap-2">
								<p className="text-2xl font-bold">No test cases yet</p>
								<p className="text-xs text-muted-foreground">
									"{epic.name}" doesn&apos;t have any test cases yet. Once test
									cases are added, they&apos;ll show up here for UAT tracking.
								</p>
							</div>
						</div>
					</div>
				}
			</div>
		</div>
	);
}

export default async function EpicPage({
	params,
}: {
	params: Promise<{ epicId: string }>;
}) {
	const { epicId } = await params;

	return (
		<Suspense fallback={<EpicPageSkeleton />}>
			<EpicContent epicId={epicId} />
		</Suspense>
		// <EpicPageSkeleton/>
	);
}
