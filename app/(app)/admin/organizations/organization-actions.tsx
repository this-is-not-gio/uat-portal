"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { renameOrg } from "@/lib/supabase/admin-actions";
import type { organization, orgRole } from "@/lib/supabase/organizations";
import { OrgRolesEditor } from "./org-roles-editor";

// Row action on the Organizations table: rename the org and manage its test roles (its type is fixed once created).
export function OrganizationActions({ org, roles }: { org: organization; roles: orgRole[] }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex flex-row gap-2 justify-end">
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="outline" className="text-xs" onClick={() => setOpen(true)}><Pencil className="size-4" /></Button>} />
				<TooltipContent>
					<p>Edit organization</p>
				</TooltipContent>
			</Tooltip>
			{/* Remounted on open so the field starts from the current name. */}
			{open && <EditOrgDialog org={org} roles={roles} open={open} onOpenChange={setOpen} />}
			<Tooltip>
				<TooltipTrigger render={<Button size="icon" variant="destructive" className="text-xs" onClick={() => setOpen(true)}><Trash className="size-4" /></Button>} />
				<TooltipContent>
					<p>Widthraw Orgranization</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

function EditOrgDialog({ org, roles, open, onOpenChange }: { org: organization; roles: orgRole[]; open: boolean; onOpenChange: (open: boolean) => void }) {
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
					<DialogDescription>Rename this organization and choose which test roles it has. Its type can&apos;t be changed.</DialogDescription>
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
				{/* Outside the name form: the roles editor has its own form, and each add/remove saves at once. */}
				{org.type !== "vendor" && (
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Test roles</Label>
						<OrgRolesEditor organizationId={org.id} roles={roles} />
					</div>
				)}
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Close</DialogClose>
					<Button type="submit" form={formId} disabled={pending || !dirty}>{pending ? "Saving…" : "Save name"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
