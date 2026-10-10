"use client";

import { useState } from "react";
import { IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { createTestRole } from "@/lib/supabase/admin-actions";
import type { organization } from "@/lib/supabase/organizations";
import { RoleForm } from "./role-form";

// organizations: the Internal/External orgs that can be given the role.
export function CreateRoleDialog({ organizations }: { organizations: organization[] }) {
	const [open, setOpen] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
				<IdCard />
				<p className="text-xs font-medium">Create new role</p>
			</DialogTrigger>
			{/* Remounted on open so each create starts from an empty form. */}
			{open && (
				<RoleForm
					title="Create new role"
					description="Add a test role to the catalog and tick the organizations whose testers can hold it."
					submitLabel="Create role"
					organizations={organizations}
					initial={{ name: "", orgIds: [] }}
					onSubmit={createTestRole}
					onDone={() => setOpen(false)}
				/>
			)}
		</Dialog>
	);
}
