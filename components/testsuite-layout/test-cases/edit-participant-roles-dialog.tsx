"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getParticipantOptions, setParticipantRoles } from "@/lib/supabase/iteration-actions";
import type { orgRole } from "@/lib/supabase/organizations";
import ParticipantRoleChecklist from "@/components/testsuite-layout/shared/participant-role-checklist";

// Changes which of an org's test roles test the suite in an open round (set_participant_roles).
export default function EditParticipantRolesDialog({
	iterationId,
	organizationId,
	organizationName,
	currentRoleIds,
	open,
	onOpenChange,
}: {
	iterationId: string;
	organizationId: string;
	organizationName: string;
	currentRoleIds: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [roles, setRoles] = useState<orgRole[] | null>(null);
	const [checked, setChecked] = useState<Set<string>>(new Set(currentRoleIds));
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		getParticipantOptions().then((result) => {
			if (cancelled) return;
			if (!result.ok) setError(result.error);
			else setRoles(result.data.roles.filter((r) => r.organizationId === organizationId));
		});
		return () => { cancelled = true; };
	}, [open, organizationId]);

	function close(next: boolean) {
		onOpenChange(next);
		if (!next) {
			setRoles(null);
			setChecked(new Set(currentRoleIds));
			setError(null);
		}
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await setParticipantRoles({ iterationId, organizationId, roleIds: [...checked] });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			close(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="flex flex-col px-2 py-3">
					<DialogTitle className="font-heading font-semibold flex flex-row items-center gap-1">
						<UserCog className="size-4" />
						Roles for {organizationName}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						The organization tests the round&apos;s cases assigned to these roles. Newly added roles get their cases right away; cases of removed roles leave a planned round now, or a running round at the next Sync.
					</DialogDescription>
				</DialogHeader>
				<div className="px-2 py-1">
					{roles
						? <ParticipantRoleChecklist roles={roles} checked={checked} onChange={setChecked} disabled={isPending} />
						: !error && <p className="text-xs text-muted-foreground">Loading roles…</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending} />}>
						<X className="size-4" />
						Cancel
					</DialogClose>
					<Button onClick={onSave} disabled={isPending || !roles || checked.size === 0}>
						<Check className="size-4" />
						{isPending ? "Saving…" : "Save roles"}
					</Button>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
