"use client";

import { useState } from "react";
import { Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/components/confirm-dialog";
import { deleteTestRole, updateTestRole } from "@/lib/supabase/admin-actions";
import type { organization } from "@/lib/supabase/organizations";
import type { roleRow } from "@/components/table/role-columns";
import { RoleForm } from "./role-form";

// Row actions on the Roles table. Unticking an org or deleting the role unassigns its holders
// there (profiles.org_role_id is set null, 0051); they stay in their org.
export function RoleActions({ role, organizations }: { role: roleRow; organizations: organization[] }) {
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
				{/* Remounted on open so the form starts from the current name and orgs. */}
				{editOpen && (
					<RoleForm
						title="Edit role"
						description="Renaming changes the role in every organization. Testers in an unticked organization lose the role."
						submitLabel="Save"
						organizations={organizations}
						initial={{ name: role.name, orgIds: role.orgs.map((org) => org.id) }}
						onSubmit={(values) => updateTestRole({ id: role.id, ...values })}
						onDone={() => setEditOpen(false)}
					/>
				)}
			</Dialog>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="Delete role"
				description={<>Delete <span className="font-medium text-foreground">{role.name}</span> from the catalog and every organization that has it?</>}
				body={role.testerCount > 0 ? <p className="text-xs text-muted-foreground">{role.testerCount} tester{role.testerCount === 1 ? "" : "s"} hold this role. They stay in their organization but lose the role.</p> : undefined}
				confirmLabel="Delete"
				onConfirm={() => deleteTestRole({ id: role.id })}
			/>
		</div>
	);
}
