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
import type { organization } from "@/lib/supabase/organizations";
import type { testIteration } from "@/lib/supabase/test-iterations";
import { ORG_TYPE_LABELS } from "@/components/testsuite-layout/shared/participant-picker";

// Brings more orgs into an open (not_started / in_progress) round — same
// checklist layout as SectionDialog's "add existing sections". Each org gets
// the same scope as everyone else, filtered by audience (add_iteration_participant).
export default function AddParticipantDialog({
	iteration,
	open,
	onOpenChange,
}: {
	iteration: testIteration;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [options, setOptions] = useState<{ organizations: organization[]; participantIds: string[]; testerCounts: Record<string, number> } | null>(null);
	const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
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
			setSelectedOrgIds(new Set());
			setError(null);
		}
	}

	function toggleOrg(id: string, checked: boolean) {
		setSelectedOrgIds((previous) => {
			const next = new Set(previous);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	}

	// One RPC per org (add_iteration_participant takes a single org). Stops at
	// the first failure; orgs already added stay added and drop off the list.
	function onAdd() {
		setError(null);
		startTransition(async () => {
			for (const organizationId of selectedOrgIds) {
				const result = await addParticipant({ iterationId: iteration.id, organizationId });
				if (!result.ok) {
					const orgName = options?.organizations.find((o) => o.id === organizationId)?.name ?? "organization";
					setError(`${orgName}: ${result.error}`);
					const refreshed = await getParticipantOptions({ iterationId: iteration.id });
					if (refreshed.ok) setOptions(refreshed.data);
					setSelectedOrgIds(new Set());
					return;
				}
			}
			close(false);
		});
	}

	const participants = options?.organizations.filter((o) => options.participantIds.includes(o.id)) ?? [];
	const available = options?.organizations.filter((o) => !options.participantIds.includes(o.id)) ?? [];

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Building2 className="size-4" />
						Add Participants to {iteration.name}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Each organization gets its own Untested copy of this round&apos;s cases that are meant for it.
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
								<ScrollArea className="border rounded-md bg-gray-50/30 max-h-60">
									<div className="flex gap-2 flex-col p-2">
										{available.length > 0 ? available.map((org) => {
											const testerCount = options.testerCounts[org.id] ?? 0;
											return (
												<label key={org.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-50/30 border cursor-pointer">
													<Checkbox
														checked={selectedOrgIds.has(org.id)}
														onCheckedChange={(checked) => toggleOrg(org.id, checked === true)}
														disabled={isPending}
													/>
													<div className="flex flex-row items-center justify-between gap-2 w-full">
														<div className="flex flex-col">
															<p className="text-xs font-medium">{org.name} - <span className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</span></p>
															<p className="text-xs text-muted-foreground"></p>
														</div>
														<p className="text-xs text-muted-foreground font-mono whitespace-nowrap">
															{testerCount} {testerCount === 1 ? "tester" : "testers"}
														</p>
													</div>
												</label>
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
					<Button onClick={onAdd} disabled={isPending || selectedOrgIds.size === 0}>
						<Check className="size-4" />
						{isPending
							? "Adding…"
							: selectedOrgIds.size === 0 ? "Add Organizations"
							: selectedOrgIds.size === 1 ? "Add 1 Organization" : `Add ${selectedOrgIds.size} Organizations`}
					</Button>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
