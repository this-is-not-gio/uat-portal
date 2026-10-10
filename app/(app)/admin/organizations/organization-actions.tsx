"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteOrg, renameOrg } from "@/lib/supabase/admin-actions";
import ConfirmDialog from "@/components/confirm-dialog";
import type { organization, orgRole } from "@/lib/supabase/organizations";

// Row action on the Organizations table: rename or withdraw the org (its type is fixed once created).
export function OrganizationActions({ org }: { org: organization & { roles: orgRole[]; testerCount: number } }) {
	const [open, setOpen] = useState(false);
	const [withdrawOpen, setWithdrawOpen] = useState(false);

	return (
		<div className="flex flex-row gap-2 justify-end">
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="outline" className="text-xs" onClick={() => setOpen(true)}><Pencil className="size-4" /></Button>} />
				<TooltipContent>
					<p>Edit organization</p>
				</TooltipContent>
			</Tooltip>
			{/* Remounted on open so the field starts from the current name. */}
			{open && <EditOrgDialog org={org} open={open} onOpenChange={setOpen} />}
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="destructive" className="text-xs" onClick={() => setWithdrawOpen(true)}><Trash className="size-4" /></Button>} />
				<TooltipContent>
					<p>Withdraw organization</p>
				</TooltipContent>
			</Tooltip>
			<ConfirmDialog
				open={withdrawOpen}
				onOpenChange={setWithdrawOpen}
				title="Withdraw organization"
				description={<>Withdraw <span className="font-medium text-foreground">{org.name}</span>? It&apos;s removed along with its test roles. Organizations with participants or past testing rounds can&apos;t be withdrawn.</>}
				body={org.testerCount > 0 ? <p className="text-xs text-muted-foreground">{org.testerCount} participant{org.testerCount === 1 ? "" : "s"} still belong to it — move or delete them first.</p> : undefined}
				confirmLabel="Withdraw"
				onConfirm={() => deleteOrg({ id: org.id })}
			/>
		</div>
	);
}

function EditOrgDialog({ org, open, onOpenChange }: { org: organization; open: boolean; onOpenChange: (open: boolean) => void }) {
	const [name, setName] = useState(org.name);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const dirty = name.trim() !== "" && name.trim() !== org.name;
	const formId = useId();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit organization</DialogTitle>
					<DialogDescription>Rename this organization. Its type can&apos;t be changed; its test roles are managed on the Roles page.</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					className="flex flex-col gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						setError(null);
						startTransition(async () => {
							const result = await renameOrg({ id: org.id, name });
							if (!result.ok) {
								setError(result.error);
								return;
							}
							onOpenChange(false);
						});
					}}>
					<Label htmlFor={`${formId}-name`} className="text-xs">Name</Label>
					<Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} className="text-xs md:text-xs" required />
					{error && <p className="text-sm text-destructive">{error}</p>}
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Close</DialogClose>
					<Button type="submit" form={formId} disabled={pending || !dirty}>{pending ? "Saving…" : "Save name"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
