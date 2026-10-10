"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { addParticipant, getParticipantOptions } from "@/lib/supabase/iteration-actions";
import type { organization, orgRole } from "@/lib/supabase/organizations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";
import ParticipantRoleChecklist from "@/components/testsuite-layout/shared/participant-role-checklist";

// Brings more orgs into an open (not_started / in_progress) round — same
// checklist layout as SectionDialog's "add existing sections". Under each picked
// org, its test roles (/admin) that test the suite; the org gets the round's cases
// whose Role Assignee is one of them (add_iteration_participant, 0054).
export default function AddParticipantDialog({
	iteration,
	open,
	onOpenChange,
}: {
	iteration: testIteration;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [options, setOptions] = useState<{ organizations: organization[]; roles: orgRole[]; participantIds: string[]; testerCounts: Record<string, number> } | null>(null);
	// Picked org id -> its picked role ids.
	const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		getParticipantOptions({ iterationId: iteration.id }).then((result) => {
			if (cancelled) return;
			if (!result.ok) setError(result.error);
			else setOptions(result.data);
		});
		return () => { cancelled = true; };
	}, [open, iteration.id]);

	function close(next: boolean) {
		onOpenChange(next);
		if (!next) {
			setOptions(null);
			setSelected(new Map());
			setError(null);
		}
	}

	const rolesOf = (orgId: string) => options?.roles.filter((r) => r.organizationId === orgId) ?? [];

	// Picking an org starts with all of its roles checked.
	function toggleOrg(id: string, checked: boolean) {
		setSelected((previous) => {
			const next = new Map(previous);
			if (checked) next.set(id, new Set(rolesOf(id).map((r) => r.id))); else next.delete(id);
			return next;
		});
	}

	function setOrgRoles(id: string, roleIds: Set<string>) {
		setSelected((previous) => new Map(previous).set(id, roleIds));
	}

	// One RPC per org (add_iteration_participant takes a single org). Stops at
	// the first failure; orgs already added stay added and drop off the list.
	function onAdd() {
		setError(null);
		startTransition(async () => {
			for (const [organizationId, roleIds] of selected) {
				const result = await addParticipant({ iterationId: iteration.id, organizationId, roleIds: [...roleIds] });
				if (!result.ok) {
					const orgName = options?.organizations.find((o) => o.id === organizationId)?.name ?? "organization";
					setError(`${orgName}: ${result.error}`);
					const refreshed = await getParticipantOptions({ iterationId: iteration.id });
					if (refreshed.ok) setOptions(refreshed.data);
					setSelected(new Map());
					return;
				}
			}
			close(false);
		});
	}

	const participants = options?.organizations.filter((o) => options.participantIds.includes(o.id)) ?? [];
	const available = options?.organizations.filter((o) => !options.participantIds.includes(o.id)) ?? [];
	const missingRoles = [...selected.values()].some((roleIds) => roleIds.size === 0);

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Building2 className="size-4" />
						Add Participants to {iteration.name}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Pick the organizations and which of their roles test this suite. Each organization gets its own Untested copy of the round&apos;s cases assigned to those roles.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2 py-1">
					{!options && !error && <p className="text-xs text-muted-foreground">Loading organizations…</p>}
					{options && (
						<>
							{/* {participants.length > 0 && (
								<div className="flex flex-col gap-2">
									<p className="text-xs text-muted-foreground">Taking part</p>
									<div className="flex flex-row flex-wrap gap-1">
										{participants.map((o) => <Badge key={o.id} variant="secondary">{o.name}</Badge>)}
									</div>
								</div>
							)} */}
							<div className="flex flex-col gap-2">
								<p className="text-xs text-muted-foreground">Organizations not yet in this iteration</p>
								<ScrollArea className="border rounded-md bg-gray-50/30 max-h-80">
									<div className="flex gap-2 flex-col p-2">
										{available.length > 0 ? available.map((org) => {
											const testerCount = options.testerCounts[org.id] ?? 0;
											const orgRoles = rolesOf(org.id);
											const pickedRoles = selected.get(org.id);
											return (
												<div key={org.id} className="flex flex-col gap-2 p-2 rounded-md bg-gray-50/30 border">
													<label className={`flex items-center gap-2 ${orgRoles.length === 0 ? "cursor-not-allowed" : "cursor-pointer"}`}>
														<Checkbox
															checked={!!pickedRoles}
															onCheckedChange={(checked) => toggleOrg(org.id, checked === true)}
															disabled={isPending || orgRoles.length === 0}
														/>
														<div className="flex flex-row items-center justify-between gap-2 w-full">
															<div className="flex flex-col">
																<p className="text-xs font-medium">{org.name} - <span className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</span></p>
																{orgRoles.length === 0 && <p className="text-xs text-muted-foreground">No test roles yet. Add them in Admin → Roles.</p>}
															</div>
															<p className="text-xs text-muted-foreground font-mono whitespace-nowrap">
																{testerCount} {testerCount === 1 ? "tester" : "testers"}
															</p>
														</div>
													</label>
													{pickedRoles && (
														<div className="pl-6">
															<ParticipantRoleChecklist roles={orgRoles} checked={pickedRoles} onChange={(next) => setOrgRoles(org.id, next)} disabled={isPending} />
														</div>
													)}
												</div>
											);
										}) : (
											<p className="text-xs text-muted-foreground">Every organization is already taking part.</p>
										)}
									</div>
								</ScrollArea>
							</div>
						</>
					)}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Close
					</DialogClose>
					<Button onClick={onAdd} disabled={isPending || selected.size === 0 || missingRoles}>
						<Check className="size-4" />
						{isPending
							? "Adding…"
							: selected.size === 0 ? "Add Organizations"
							: selected.size === 1 ? "Add 1 Organization" : `Add ${selected.size} Organizations`}
					</Button>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
