import OverviewTabSkeleton from "@/components/testsuite-layout/overview/overview-tab-skeleton";

// Shown under the suite header/tabs while the Overview data loads (replaces the old <Suspense> fallback).
export default function Loading() {
	return <OverviewTabSkeleton />;
}
