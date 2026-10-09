"use client";

import { useId, useState, useTransition } from "react";
import { BuildingComplexPlus, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrg, createOrgRole } from "@/lib/supabase/admin-actions";
import { Constants } from "@/lib/supabase/database.types";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { orgType } from "@/lib/supabase/organizations";
import { sameRoleName } from "@/lib/auth/test-role";

// Internal first: that's the org type being set up now (External is deferred).
const TYPE_OPTIONS: orgType[] = ["client", "external", "vendor"];
const ROLE_SUGGESTIONS = Constants.public.Enums.role_assignee_type;

export function CreateOrgDialog() {
	const [open, setOpen] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
				<BuildingComplexPlus />
				<p className="text-xs font-medium">Create new organization</p>
			</DialogTrigger>
			{/* Remounted on open so each create starts from an empty form. */}
			{open && <CreateOrgForm onDone={() => setOpen(false)} />}
		</Dialog>
	);
}

function CreateOrgForm({ onDone }: { onDone: () => void }) {
	const formId = useId();
	const [name, setName] = useState("");
	const [type, setType] = useState<orgType>("client");
	const [roleNames, setRoleNames] = useState<string[]>([]);
	const [roleInput, setRoleInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	// The vendor org is Admin-only and doesn't test, so it gets no test roles.
	const hasRoles = type !== "vendor";

	function addRole() {
		const trimmed = roleInput.trim();
		if (!trimmed) return;
		if (!roleNames.some((r) => sameRoleName(r, trimmed))) setRoleNames([...roleNames, trimmed]);
		setRoleInput("");
	}

	function submit() {
		setError(null);
		startTransition(async () => {
			const created = await createOrg({ name, type });
			if (!created.ok) {
				setError(created.error);
				return;
			}
			if (hasRoles) {
				for (const roleName of roleNames) {
					const result = await createOrgRole({ organizationId: created.data.id, name: roleName });
					if (!result.ok) {
						// The org exists now; the rest can be added from its Edit dialog.
						setError(`Organization created, but adding "${roleName}" failed: ${result.error}`);
						return;
					}
				}
			}
			onDone();
		});
	}

	return (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Create new organization</DialogTitle>
				<DialogDescription>Add an organization and the test roles its participants can have.</DialogDescription>
			</DialogHeader>
			<form id={formId} className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${formId}-name`} className="text-xs">Name</Label>
					<Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IC Licensing Division" className="text-xs md:text-xs" required />
				</div>
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Type</Label>
					<Select value={type} onValueChange={(value) => value && setType(value as orgType)}>
						<SelectTrigger className="w-full text-xs">
							<SelectValue>{ORG_TYPE_LABELS[type]}</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							{TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t} className="text-xs">{ORG_TYPE_LABELS[t]}</SelectItem>)}
						</SelectContent>
					</Select>
				</div>
			</form>
			{hasRoles && (
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Test roles</Label>
					<div className="flex flex-wrap gap-1">
						{roleNames.length === 0 && <span className="text-xs text-muted-foreground">No roles yet. You can also add them later.</span>}
						{roleNames.map((roleName) => (
							<span key={roleName} className="flex items-center gap-1 rounded-md bg-gray-600/5 py-0.5 pl-1.5 pr-1 text-xs text-gray-800">
								{roleName}
								<button type="button" aria-label={`Remove ${roleName}`} className="rounded-sm opacity-60 hover:opacity-100" onClick={() => setRoleNames(roleNames.filter((r) => r !== roleName))}>
									<XIcon className="size-3" />
								</button>
							</span>
						))}
					</div>
					{/* Outside the form: Enter adds the chip instead of submitting the dialog. */}
					<div className="flex items-center gap-2">
						<Input
							className="h-8 text-xs md:text-xs"
							placeholder="Add role"
							list={`${formId}-roles`}
							value={roleInput}
							onChange={(e) => setRoleInput(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }}
						/>
						<datalist id={`${formId}-roles`}>
							{ROLE_SUGGESTIONS.filter((s) => !roleNames.some((r) => sameRoleName(r, s))).map((s) => <option key={s} value={s} />)}
						</datalist>
						<Button size="sm" variant="outline" type="button" onClick={addRole}>Add</Button>
					</div>
				</div>
			)}
			{error && <p className="text-sm text-destructive">{error}</p>}
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create organization"}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
