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
import type { TestingSuites } from "@/lib/supabase/Init";

const SEGMENT_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	masterPlan: "Master Plan",
	testingsuite: "Testing Suites",
};

function labelForSegment(segment: string, testingSuites: TestingSuites) {
	const suite = testingSuites.find((testingSuite) => testingSuite.id === segment);
	if (suite) return suite.title;
	return SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
}

export function SiteHeader({ testingSuites }: { testingSuites: TestingSuites }) {
	const pathname = usePathname();
	const segments = pathname.split("/").filter(Boolean);

	const crumbs = segments.map((segment, index) => ({
		href: "/" + segments.slice(0, index + 1).join("/"),
		label: labelForSegment(segment, testingSuites),
		isLast: index === segments.length - 1,
	}));

	return (
		<header className="flex shrink-0 items-center gap-2 transition-[width,height] ease-linear p-4 ">
			<Breadcrumb>
				<BreadcrumbList>
					{crumbs.map((crumb) => (
						<Fragment key={crumb.href}>
							<BreadcrumbItem className="">
								{crumb.isLast ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link href={crumb.href} />}>
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
