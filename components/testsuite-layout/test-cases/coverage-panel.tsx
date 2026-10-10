"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, TriangleAlert, UserGroup } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { setTestersExcluded } from "@/lib/supabase/iteration-actions";
import type { coverageRole, coverageUser, roundCoverage } from "@/lib/supabase/test-iterations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import { coverageBlockers } from "./coverage-blockers";

// A planned round's testers: every role its scope needs, the orgs holding it and their users,
// ticked unless staff untick them. The roster is fixed from the ticks when the round starts.
export default function CoveragePanel({ iterationId, coverage }: { iterationId: string; coverage: roundCoverage }) {
	return (
		<CoverageView
			coverage={coverage}
			onToggle={(userIds, ticked) => setTestersExcluded({ iterationId, userIds, excluded: !ticked })}
		/>
	);
}

// The coverage list itself, shared with the round wizard (which keeps ticks until it creates the
// round). onToggle saves a change; the view shows it at once and falls back when it fails.
export function CoverageView({ coverage, onToggle, blockerExtra }: {
	coverage: roundCoverage;
	onToggle: (userIds: string[], ticked: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
	blockerExtra?: React.ReactNode;
}) {
	// userId -> ticked, applied over the server's answer until refresh() brings the new coverage.
	const [ticks, setTick] = useOptimistic(new Map<string, boolean>(), (current, change: { userIds: string[]; ticked: boolean }) => {
		const next = new Map(current);
		for (const id of change.userIds) next.set(id, change.ticked);
		return next;
	});
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [defaultOpen] = useState(coverage.roles.length > 0 || coverage.casesWithoutRole.length > 0);

	const isTicked = (user: coverageUser) => ticks.get(user.userId) ?? user.ticked;

	function toggle(userIds: string[], ticked: boolean) {
		if (userIds.length === 0) return;
		setError(null);
		startTransition(async () => {
			setTick({ userIds, ticked });
			const result = await onToggle(userIds, ticked);
			if (!result.ok) setError(result.error);
		});
	}

	const tickedTotal = coverage.roles.reduce((sum, role) => sum + role.orgs.reduce((n, org) => n + org.users.filter(isTicked).length, 0), 0);
	const blockers = coverageBlockers(coverage);

	return (
		<Collapsible defaultOpen={defaultOpen}>
			<div className="border rounded-md overflow-hidden">
				<div className="p-4 bg-gray-200/10 flex flex-row items-center justify-between gap-2">
					<div className="flex flex-row items-center gap-2 w-full">
						<UserGroup className="size-5" />
						<p className="text-xs font-medium">Testers</p>
						{coverage.roles.length === 0
							? <Badge variant="secondary" className="text-xs">No test roles in scope</Badge>
							: <Badge variant="secondary" className="text-xs">{tickedTotal} {tickedTotal === 1 ? "tester" : "testers"} · {coverage.roles.length} {coverage.roles.length === 1 ? "role" : "roles"}</Badge>}
					</div>
					<CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" className="group" aria-label="Toggle testers" />}>
						<ChevronDown className="size-4 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
					</CollapsibleTrigger>
				</div>
				<CollapsibleContent className="border-t">
					<div className="p-4 flex flex-col gap-4">
						{blockers.length > 0 && (
							<div role="alert" className="text-xs rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3 flex flex-col gap-1">
								<p className="font-medium flex flex-row items-center gap-1.5"><TriangleAlert size={14} /> The round can&apos;t start yet</p>
								<ul className="list-disc pl-5">
									{blockers.map((b) => <li key={b}>{b}</li>)}
								</ul>
								{coverage.casesWithoutRole.length > 0 && (
									<p className="text-amber-900/80">
										No role: {coverage.casesWithoutRole.map((c) => [c.code, c.title].filter(Boolean).join(" ")).join(", ")}
									</p>
								)}
								{blockerExtra}
							</div>
						)}
						{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
						{coverage.roles.length === 0 ? (
							<p className="text-xs text-muted-foreground text-center py-4">Add sections to see which test roles this round needs.</p>
						) : (
							coverage.roles.map((role) => (
								<RoleBlock key={role.testRoleId} role={role} isTicked={isTicked} onToggle={toggle} disabled={isPending} />
							))
						)}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

function RoleBlock({ role, isTicked, onToggle, disabled }: {
	role: coverageRole;
	isTicked: (user: coverageUser) => boolean;
	onToggle: (userIds: string[], ticked: boolean) => void;
	disabled: boolean;
}) {
	const ticked = role.orgs.reduce((n, org) => n + org.users.filter(isTicked).length, 0);

	return (
		<div className="rounded-md border">
			<div className="px-3 py-2 flex flex-row flex-wrap items-center gap-2 border-b bg-muted/30">
				<p className="text-xs font-semibold">{role.name}</p>
				<Badge variant="secondary" className="text-xs">{role.caseCount} {role.caseCount === 1 ? "test case" : "test cases"}</Badge>
				<span className={ticked === 0 ? "text-xs text-amber-800 font-medium" : "text-xs text-muted-foreground"}>
					{ticked}/{role.availableCount} ticked
				</span>
			</div>
			{role.orgs.length === 0 ? (
				<p className="px-3 py-2 text-xs text-amber-800">No organization has a user with this role. Assign it on the Users page.</p>
			) : (
				<div className="flex flex-col divide-y">
					{role.orgs.map((org) => {
						const ids = org.users.map((u) => u.userId);
						const tickedCount = org.users.filter(isTicked).length;
						return (
							<div key={org.organizationId} className="px-3 py-2 flex flex-col gap-1.5">
								<label className="flex flex-row items-center gap-2">
									<Checkbox
										checked={tickedCount === ids.length}
										indeterminate={tickedCount > 0 && tickedCount < ids.length}
										onCheckedChange={(checked) => onToggle(ids, !!checked)}
										disabled={disabled}
										aria-label={`All ${org.name} testers for ${role.name}`}
									/>
									<span className="text-xs font-medium">{org.name}</span>
									<span className="text-xs text-muted-foreground font-mono">{ORG_TYPE_LABELS[org.type]}</span>
								</label>
								<div className="pl-6 flex flex-col gap-1">
									{org.users.map((user) => (
										<label key={user.userId} className="flex flex-row items-center gap-2">
											<Checkbox
												checked={isTicked(user)}
												onCheckedChange={(checked) => onToggle([user.userId], !!checked)}
												disabled={disabled}
											/>
											<span className="text-xs">{user.fullName ?? "Unnamed user"}</span>
										</label>
									))}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
