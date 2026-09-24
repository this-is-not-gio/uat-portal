"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./ui/breadcrumb";
import type { TestingSuites } from "@/lib/supabase/Init";

const SEGMENT_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	masterPlan: "Master Plan",
	testingsuite: "Testing Suites",
};

const TAB_LABELS: Record<string, string> = {
	overview: "Overview",
	"test-cases": "Test Cases",
	"test-results": "Test Results",
};

function labelForSegment(segment: string, testingSuites: TestingSuites) {
	const suite = testingSuites.find((testingSuite) => testingSuite.slug === segment);
	if (suite) return suite.title;
	return SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
}

export function SiteHeader({ testingSuites }: { testingSuites: TestingSuites }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const segments = pathname.split("/").filter(Boolean);
	const isTestSuiteRoute = segments[0] === "testingsuite" && segments.length > 1;

	// Inside a testing suite, only "testingsuite" and the suite slug become
	// path-based crumbs — any section/"all" path segment is an implementation
	// detail, not something to show. The active tab becomes the final crumb.
	const pathSegments = isTestSuiteRoute ? segments.slice(0, 2) : segments;

	const crumbs = pathSegments.map((segment, index) => ({
		href: "/" + segments.slice(0, index + 1).join("/"),
		label: labelForSegment(segment, testingSuites),
		isLast: !isTestSuiteRoute && index === pathSegments.length - 1,
	}));

	if (isTestSuiteRoute) {
		const tab = searchParams.get("tab") ?? "overview";
		crumbs.push({
			href: pathname + "?" + searchParams.toString(),
			label: TAB_LABELS[tab] ?? tab,
			isLast: true,
		});
	}

	return (
		<header className="flex shrink-0 items-center gap-2 transition-[width,height] ease-linear p-4 ">
			<Breadcrumb>
				<BreadcrumbList>
					{crumbs.map((crumb) => (
						<Fragment key={crumb.href}>
							<BreadcrumbItem className="">
								{crumb.isLast ? (
									<BreadcrumbPage className="text-xs">{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link href={crumb.href} />} className="text-xs">
										{crumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!crumb.isLast && <BreadcrumbSeparator />}
						</Fragment>
					))}
				</BreadcrumbList>
			</Breadcrumb>
		</header>
	);
}
