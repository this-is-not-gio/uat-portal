"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { participationProgress } from "@/lib/supabase/overview";
import { ORG_TYPE_LABELS } from "./participant-picker";

// Per-org progress + submission state for one round (tester-screens plan §2.2), for Admin and
// Internal. Each org name switches the Results lens (?org=) to that org's rows.
export default function ParticipationPanel({
	participation,
	selectedOrgId,
}: {
	participation: participationProgress[];
	selectedOrgId: string | null;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function hrefFor(orgId: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("org", orgId);
		return `${pathname}?${params.toString()}`;
	}

	return (
		<div className="border rounded-md">
			<p className="text-xs text-muted-foreground px-4 pt-3 pb-2">Participation</p>
			<div className="flex flex-col divide-y">
				{participation.map(({ organization, submittedAt, counts }) => {
					const tested = counts.passed + counts.failed + counts.blocked;
					const notTested = counts.untested + counts.inProgress;
					return (
						<div
							key={organization.id}
							className={cn("grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_auto_minmax(0,1.2fr)] items-center gap-4 px-4 py-2", organization.id === selectedOrgId && "bg-muted/50")}
						>
							<div className="min-w-0">
								<Link href={hrefFor(organization.id)} className="text-sm font-medium hover:underline truncate block">{organization.name}</Link>
								<p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[organization.type]}</p>
							</div>
							<div className="flex flex-row items-center gap-2">
								<div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
									<div className="h-full bg-primary" style={{ width: `${counts.total ? (tested / counts.total) * 100 : 0}%` }} />
								</div>
								<p className="text-xs font-mono text-muted-foreground shrink-0">{tested}/{counts.total}</p>
							</div>
							<p className="text-xs font-mono flex flex-row gap-2">
								<span className="text-green-800">✔ {counts.passed}</span>
								<span className="text-red-800">✖ {counts.failed}</span>
								<span className="text-muted-foreground">⊘ {counts.blocked}</span>
							</p>
							<p className="text-xs text-right">
								{/* Only External orgs submit (D4); the client's "done" is Complete round. */}
								{organization.type !== "external" ? (
									<span className="text-muted-foreground">—</span>
								) : submittedAt ? (
									<span className="text-green-800">
										Submitted {format(parseISO(submittedAt), "MMM d")}
										{notTested > 0 && <span className="text-muted-foreground"> · {notTested} not tested</span>}
									</span>
								) : (
									<span className="text-muted-foreground">{tested === 0 ? "Not started" : "Testing"}</span>
								)}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
