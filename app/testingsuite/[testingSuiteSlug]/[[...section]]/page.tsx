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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getTestSuite } from "@/lib/supabase/test-suite";
import PageTab from "../page-tab";
import TestCasesTab from "../test-cases-tab";





export default async function TestsuitePage({
	params,
	searchParams,
}: {
	params: Promise<{ testingSuiteSlug: string; section?: string[] }>;
	searchParams: Promise<{ tab?: string }>;
}) {
	const { testingSuiteSlug, section } = await params;
	const { tab } = await searchParams;
	const sectionSlug = section?.[0];
	const testSuite = await getTestSuite({ slug: testingSuiteSlug });
	if (!testSuite) notFound();

	const testCasesTabSlot =
		tab === "test-cases" ?
				<TestCasesTab testSuiteId={testSuite.id} testSuiteSlug={testingSuiteSlug} sectionSlug={sectionSlug} />
			: null

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="px-6">
				<div>
					<h1 className="text-2xl font-bold">{testSuite.name}</h1>
					<p className="text-xs text-muted-foreground">Testing Suite</p>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<PageTab testCasesTab={testCasesTabSlot} />
			</div>
		</div>
	)
}

