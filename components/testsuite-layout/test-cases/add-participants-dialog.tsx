"use client";

import { useState, useTransition } from "react";
import { Check, TriangleAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { setTestersExcluded } from "@/lib/supabase/iteration-actions";
import type { coverageUser, roundCoverage } from "@/lib/supabase/test-iterations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import { coverageBlockers } from "./coverage-blockers";

// Picks who tests a planned round. Above: only the roles the round's cases require, the ones
// still without a tester flagged first. Below: the people holding the selected role, grouped by
// org; ticking one puts them on the roster (it's fixed when the round starts). Each tick saves
// at once, and the list shows it before the server answers.
export default function AddParticipantsDialog({
	iterationId,
	coverage,
	open,
	onOpenChange,
}: {
	iterationId: string;
	coverage: roundCoverage;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [activeId, setActiveId] = useState<string | null>(null);
	// userId -> ticked, laid over the server's answer until the page refreshes with the new coverage.
	const [ticks, setTicks] = useState<Map<string, boolean>>(new Map());
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const isTicked = (user: coverageUser) => ticks.get(user.userId) ?? user.ticked;
	const tickedIn = (role: roundCoverage["roles"][number]) => role.orgs.reduce((n, org) => n + org.users.filter(isTicked).length, 0);

	// Roles with nobody ticked come first: those are what the round still needs.
	const roles = [...coverage.roles].sort((a, b) => Number(tickedIn(a) > 0) - Number(tickedIn(b) > 0));
	const active = coverage.roles.find((role) => role.testRoleId === activeId) ?? null;
	const missing = roles.filter((role) => tickedIn(role) === 0).length;
	const blockers = coverageBlockers(coverage);

	function toggle(userIds: string[], ticked: boolean) {
		if (userIds.length === 0) return;
		setError(null);
		const previous = ticks;
		setTicks((current) => {
			const next = new Map(current);
			for (const id of userIds) next.set(id, ticked);
			return next;
		});
		startTransition(async () => {
			const result = await setTestersExcluded({ iterationId, userIds, excluded: !ticked });
			if (!result.ok) {
				setTicks(previous);
				setError(result.error);
			}
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setActiveId(null); setError(null); } }}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<UserPlus className="size-4" />
						Add participants
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Pick a role this round needs, then choose who tests it. Roles with nobody ticked block the round from starting.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3 px-2">
					<div className="flex flex-col gap-1">
						<div className="flex flex-row items-center justify-between">
							<p className="text-xs text-muted-foreground">Required roles</p>
							{missing > 0 && <span className="text-xs text-amber-800 font-medium">{missing} still need{missing === 1 ? "s" : ""} a tester</span>}
						</div>
						<div className="flex flex-row flex-wrap gap-1.5">
							{roles.length === 0 ? (
								<p className="text-xs text-muted-foreground py-2">Add test cases to see which roles this round needs.</p>
							) : roles.map((role) => {
								const ticked = tickedIn(role);
								return (
									<button
										key={role.testRoleId}
										type="button"
										onClick={() => setActiveId(role.testRoleId)}
										aria-pressed={role.testRoleId === activeId}
										title={`${role.caseCount} ${role.caseCount === 1 ? "test case" : "test cases"}`}
									>
										<Badge variant={role.testRoleId === activeId ? "default" : "secondary"} className="gap-1 text-xs cursor-pointer">
											{ticked === 0 && <TriangleAlert size={12} className="text-amber-600" />}
											{role.name}
											<span className="font-mono opacity-70">{ticked}/{role.availableCount}</span>
										</Badge>
									</button>
								);
							})}
						</div>
					</div>

					{active && (
						<div className="flex flex-col gap-1">
							<p className="text-xs text-muted-foreground">People testing as {active.name}</p>
							<ScrollArea className="border rounded-md max-h-56">
								<div className="flex flex-col divide-y">
									{active.orgs.length === 0 && (
										<p className="px-3 py-2 text-xs text-amber-800">No organization has a user with this role. Assign it on the Users page.</p>
									)}
									{active.orgs.map((org) => {
										const ids = org.users.map((u) => u.userId);
										const count = org.users.filter(isTicked).length;
										return (
											<div key={org.organizationId} className="px-3 py-2 flex flex-col gap-1.5">
												<label className="flex flex-row items-center gap-2">
													<Checkbox
														checked={count === ids.length}
														indeterminate={count > 0 && count < ids.length}
														onCheckedChange={(checked) => toggle(ids, !!checked)}
														disabled={isPending}
														aria-label={`All ${org.name} testers for ${active.name}`}
													/>
													<span className="text-xs font-medium">{org.name}</span>
													<span className="text-xs text-muted-foreground font-mono">{ORG_TYPE_LABELS[org.type]}</span>
												</label>
												<div className="pl-6 flex flex-col gap-1">
													{org.users.map((user) => (
														<label key={user.userId} className="flex flex-row items-center gap-2">
															<Checkbox
																checked={isTicked(user)}
																onCheckedChange={(checked) => toggle([user.userId], !!checked)}
																disabled={isPending}
															/>
															<span className="text-xs">{user.fullName ?? "Unnamed user"}</span>
														</label>
													))}
												</div>
											</div>
										);
									})}
								</div>
							</ScrollArea>
						</div>
					)}
					{blockers.length > 0 && (
						<ul role="status" className="list-disc pl-5 text-xs text-amber-800">
							{blockers.map((b) => <li key={b}>{b}</li>)}
						</ul>
					)}
					{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button disabled={isPending} />}>
						<Check className="size-4" />
						Done
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
