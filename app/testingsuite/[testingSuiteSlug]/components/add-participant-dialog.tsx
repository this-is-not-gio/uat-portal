"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ORG_TYPE_LABELS } from "./participant-picker";

// Brings another org into an open (not_started / in_progress) round. It gets
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
	const [options, setOptions] = useState<{ organizations: organization[]; participantIds: string[] } | null>(null);
	const [orgId, setOrgId] = useState<string | null>(null);
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
			setOrgId(null);
			setError(null);
		}
	}

	function onAdd() {
		if (!orgId) return;
		setError(null);
		startTransition(async () => {
			const result = await addParticipant({ iterationId: iteration.id, organizationId: orgId });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			close(false);
		});
	}

	const participants = options?.organizations.filter((o) => options.participantIds.includes(o.id)) ?? [];
	const available = options?.organizations.filter((o) => !options.participantIds.includes(o.id)) ?? [];
	const picked = available.find((o) => o.id === orgId);

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<Building2 className="size-4" />
						Add an organization to {iteration.name}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						The organization gets its own Untested copy of this round&apos;s cases that are meant for it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-2">
					{!options && !error && <p className="text-xs text-muted-foreground">Loading organizations…</p>}
					{options && (
						<>
							<div className="flex flex-col gap-1">
								<Label className="text-xs text-muted-foreground">Taking part</Label>
								<div className="flex flex-row flex-wrap gap-1">
									{participants.map((o) => <Badge key={o.id} variant="secondary">{o.name}</Badge>)}
								</div>
							</div>
							{available.length === 0 ? (
								<p className="text-xs text-muted-foreground">Every organization is already taking part.</p>
							) : (
								<div className="flex flex-col gap-1">
									<Label className="text-xs text-muted-foreground">Organization</Label>
									<Select value={orgId} onValueChange={(value) => setOrgId(value as string | null)} disabled={isPending}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Choose an organization">{picked?.name}</SelectValue>
										</SelectTrigger>
										<SelectContent alignItemWithTrigger={false}>
											{available.map((org) => (
												<SelectItem key={org.id} value={org.id}>
													<div className="flex flex-col">
														<p className="text-sm">{org.name}</p>
														<p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</p>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</>
					)}
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onAdd} disabled={isPending || !orgId}>
						<Plus className="size-4" />
						{isPending ? "Adding…" : "Add organization"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
