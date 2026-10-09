"use client";

import { useId, useState, useTransition } from "react";
import { IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrgRole } from "@/lib/supabase/admin-actions";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { organization } from "@/lib/supabase/organizations";

export function CreateRoleDialog({ organizations }: { organizations: organization[] }) {
	const [open, setOpen] = useState(false);
	// The vendor org doesn't test, so roles only go on Internal/External orgs.
	const testingOrgs = organizations.filter((org) => org.type !== "vendor");
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
				<IdCard />
				<p className="text-xs font-medium">Create new role</p>
			</DialogTrigger>
			{/* Remounted on open so each create starts from an empty form. */}
			{open && <CreateRoleForm organizations={testingOrgs} onDone={() => setOpen(false)} />}
		</Dialog>
	);
}

function CreateRoleForm({ organizations, onDone }: { organizations: organization[]; onDone: () => void }) {
	const formId = useId();
	const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const org = organizations.find((o) => o.id === organizationId);

	return (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>Create new role</DialogTitle>
				<DialogDescription>Add a test role to an organization. Its testers can then be given this role.</DialogDescription>
			</DialogHeader>
			<form
				id={formId}
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					setError(null);
					startTransition(async () => {
						const result = await createOrgRole({ organizationId, name });
						if (!result.ok) {
							setError(result.error);
							return;
						}
						onDone();
					});
				}}>
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Organization</Label>
					<Select value={organizationId} onValueChange={(value) => value && setOrganizationId(value)}>
						<SelectTrigger className="w-full text-xs" disabled={!organizations.length}>
							<SelectValue>{org ? `${org.name} · ${ORG_TYPE_LABELS[org.type]}` : "No organizations yet"}</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							{organizations.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.name} · {ORG_TYPE_LABELS[o.type]}</SelectItem>)}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${formId}-name`} className="text-xs">Role name</Label>
					<Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Action-Officer" className="text-xs md:text-xs" required />
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</form>
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !organizationId || !name.trim()}>{pending ? "Creating…" : "Create role"}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
