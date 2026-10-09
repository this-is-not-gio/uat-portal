"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/components/confirm-dialog";
import { deleteOrgRole, renameOrgRole } from "@/lib/supabase/admin-actions";
import type { roleRow } from "@/components/table/role-columns";

// Row actions on the Roles table. Deleting a role unassigns it (profiles.org_role_id is set null, 0051).
export function RoleActions({ role }: { role: roleRow }) {
	const [open, setOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

	return (
		<div className="flex flex-row gap-2 justify-end">
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="outline" className="text-xs" onClick={() => setEditOpen(true)}><Pencil className="size-4" /></Button>} />
				<TooltipContent>
					<p>Edit role</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="destructive" className="text-xs" onClick={() => setOpen(true)}><Trash className="size-4" /></Button>} />
				<TooltipContent>
					<p>Delete role</p>
				</TooltipContent>
			</Tooltip>
			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				{/* Remounted on open so the form starts from the current name. */}
				{editOpen && <EditRoleForm role={role} onDone={() => setEditOpen(false)} />}
			</Dialog>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="Delete role"
				description={<>Delete <span className="font-medium text-foreground">{role.name}</span> from {role.orgName}?</>}
				body={role.testerCount > 0 ? <p className="text-xs text-muted-foreground">{role.testerCount} tester{role.testerCount === 1 ? "" : "s"} hold this role. They stay in {role.orgName} but lose the role.</p> : undefined}
				confirmLabel="Delete"
				onConfirm={() => deleteOrgRole({ id: role.id })}
			/>
		</div>
	);
}

function EditRoleForm({ role, onDone }: { role: roleRow; onDone: () => void }) {
	const formId = useId();
	const [name, setName] = useState(role.name);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const unchanged = name.trim() === role.name;

	return (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>Edit role</DialogTitle>
				<DialogDescription>Rename this role in {role.orgName}. Testers holding it keep the role.</DialogDescription>
			</DialogHeader>
			<form
				id={formId}
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (unchanged) return onDone();
					setError(null);
					startTransition(async () => {
						const result = await renameOrgRole({ id: role.id, name });
						if (!result.ok) {
							setError(result.error);
							return;
						}
						onDone();
					});
				}}>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${formId}-name`} className="text-xs">Role name</Label>
					<Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} className="text-xs md:text-xs" required autoFocus />
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</form>
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !name.trim() || unchanged}>{pending ? "Saving…" : "Save"}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
