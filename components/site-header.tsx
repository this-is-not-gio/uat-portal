"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./ui/breadcrumb";
import type { SidebarSuite } from "@/lib/supabase/Init";
import { SidebarTrigger } from "./ui/sidebar";

const SEGMENT_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	masterPlan: "Testing Master Plan",
	exports: "Exports",
	testsuite: "Testing Suites",
};

const TAB_LABELS: Record<string, string> = {
	overview: "Overview",
	"test-cases": "Test Cases",
	"test-results": "Test Results",
	"sign-off": "Sign-off",
};

function labelForSegment(segment: string, testingSuites: SidebarSuite[]) {
	const suite = testingSuites.find((testingSuite) => testingSuite.slug === segment);
	if (suite) return suite.title;
	return SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
}

export function SiteHeader({ testingSuites }: { testingSuites: SidebarSuite[] }) {
	const pathname = usePathname();
	const segments = pathname.split("/").filter(Boolean);
	const isTestSuiteRoute = segments[0] === "testsuite" && segments.length > 1;

	// Inside a testing suite, only "testsuite" and the suite slug become
	// path-based crumbs — any section/"all" path segment after the tab is an
	// implementation detail, not something to show. The tab becomes the final crumb.
	const pathSegments = isTestSuiteRoute ? segments.slice(0, 2) : segments;

	const crumbs = pathSegments.map((segment, index) => ({
		href: "/" + segments.slice(0, index + 1).join("/"),
		label: labelForSegment(segment, testingSuites),
		isLast: !isTestSuiteRoute && index === pathSegments.length - 1,
	}));

	if (isTestSuiteRoute) {
		const tab = segments[2] ?? "overview";
		crumbs.push({
			href: `/${segments[0]}/${segments[1]}/${tab}`,
			label: TAB_LABELS[tab] ?? tab,
			isLast: true,
		});
	}

	return (
		<header data-slot="site-header" className="flex shrink-0 items-center gap-2 transition-[width,height] ease-linear p-2 border-b border-border bg-background">
			<SidebarTrigger/>
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
