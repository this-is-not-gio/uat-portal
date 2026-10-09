"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/components/confirm-dialog";
import { deleteUser, updateUserRole, type adminUser } from "@/lib/supabase/admin-actions";
import type { orgRole } from "@/lib/supabase/organizations";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";

const NONE = "__none__";

// Row actions on the Participants table: edit the test role, or delete the user.
export function ParticipantActions({ user, roles }: { user: adminUser; roles: orgRole[] }) {
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const name = user.fullName || user.email || "this participant";

	return (
		<div className="flex flex-row gap-2 justify-end">
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="outline" className="text-xs" onClick={() => setEditOpen(true)}><Pencil className="size-4" /></Button>} />
				<TooltipContent>
					<p>Edit user role</p>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="destructive" className="text-xs" onClick={() => setDeleteOpen(true)}><Trash className="size-4" /></Button>} />
				<TooltipContent>
					<p>Delete user</p>
				</TooltipContent>
			</Tooltip>

			{/* Remounted on open so the picker starts from the user's current role. */}
			{editOpen && <EditTestRoleDialog user={user} roles={roles} open={editOpen} onOpenChange={setEditOpen} />}
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete participant"
				description={<>Delete <span className="font-medium text-foreground">{name}</span>? They lose access to the portal. Participants with test activity can&apos;t be deleted.</>}
				confirmLabel="Delete"
				onConfirm={() => deleteUser({ userId: user.id })}
			/>
		</div>
	);
}

// Only the test role is editable here; the access role and organization stay as they are.
function EditTestRoleDialog({ user, roles, open, onOpenChange }: {
	user: adminUser;
	roles: orgRole[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const org = user.organization;
	const orgRoles = roles.filter((r) => r.organizationId === org?.id);
	const [orgRoleId, setOrgRoleId] = useState(user.orgRole?.id ?? NONE);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const selected = orgRoles.find((r) => r.id === orgRoleId);
	const dirty = orgRoleId !== (user.orgRole?.id ?? NONE);

	function save() {
		if (!org) return;
		setError(null);
		startTransition(async () => {
			const result = await updateUserRole({
				userId: user.id,
				role: user.role,
				organizationId: org.id,
				orgRoleId: orgRoleId === NONE ? null : orgRoleId,
			});
			if (!result.ok) {
				setError(result.error);
				return;
			}
			onOpenChange(false);
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit user role</DialogTitle>
					<DialogDescription>Change the test role this participant tests as.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
						<span className="text-muted-foreground">Participant</span>
						<span className="font-medium">{user.fullName || "—"}</span>
						<span className="text-muted-foreground">Email</span>
						<span>{user.email ?? "—"}</span>
						<span className="text-muted-foreground">Organization</span>
						<span>{org ? `${org.name} · ${ORG_TYPE_LABELS[org.type]}` : "—"}</span>
					</div>
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Test role</Label>
						{orgRoles.length ? (
							<Select value={orgRoleId} onValueChange={(value) => setOrgRoleId(value ?? NONE)}>
								<SelectTrigger className="w-full text-xs">
									<SelectValue>{selected?.name ?? "No test role"}</SelectValue>
								</SelectTrigger>
								<SelectContent alignItemWithTrigger={false}>
									<SelectItem value={NONE} className="text-xs">No test role</SelectItem>
									{orgRoles.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>)}
								</SelectContent>
							</Select>
						) : (
							<p className="text-xs text-muted-foreground">
								{org ? "This organization has no test roles yet. Add them on the Roles tab." : "This participant has no organization."}
							</p>
						)}
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
					<Button onClick={save} disabled={pending || !dirty || !org}>{pending ? "Saving…" : "Save"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
