"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { organization, orgType } from "@/lib/supabase/organizations";

// Create/Edit dialog body for a catalog role: its name and the orgs that have it.
// organizations: the Internal/External orgs (the vendor org doesn't test).
export function RoleForm({ title, description, submitLabel, organizations, initial, onSubmit, onDone }: {
	title: string;
	description: string;
	submitLabel: string;
	organizations: organization[];
	initial: { name: string; orgIds: string[] };
	onSubmit: (values: { name: string; orgIds: string[] }) => Promise<{ ok: true } | { ok: false; error: string }>;
	onDone: () => void;
}) {
	const formId = useId();
	const [name, setName] = useState(initial.name);
	const [orgIds, setOrgIds] = useState(new Set(initial.orgIds));
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const unchanged = name.trim() === initial.name && orgIds.size === initial.orgIds.length && initial.orgIds.every((id) => orgIds.has(id));

	function toggle(id: string, checked: boolean) {
		const next = new Set(orgIds);
		if (checked) next.add(id);
		else next.delete(id);
		setOrgIds(next);
	}

	return (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<form
				id={formId}
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (unchanged) return onDone();
					setError(null);
					startTransition(async () => {
						const result = await onSubmit({ name, orgIds: [...orgIds] });
						if (!result.ok) {
							setError(result.error);
							return;
						}
						onDone();
					});
				}}>
				<div className="flex flex-col gap-2">
					<Label htmlFor={`${formId}-name`} className="text-xs">Role name</Label>
					<Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Action Officer - Licensing" className="text-xs md:text-xs" required autoFocus />
				</div>
				<div className="flex flex-col gap-2">
					<Label className="text-xs">Organizations with this role</Label>
					{organizations.length === 0 && <p className="text-xs text-muted-foreground">No Internal or External organizations yet.</p>}
					{(["client", "external"] as orgType[]).map((type) => {
						const orgs = organizations.filter((org) => org.type === type);
						if (!orgs.length) return null;
						return (
							<div key={type} className="flex flex-col gap-1.5">
								<p className="text-xs font-medium text-muted-foreground">{ORG_TYPE_LABELS[type]}</p>
								{orgs.map((org) => (
									<label key={org.id} className="flex flex-row items-center gap-2 text-xs">
										<Checkbox checked={orgIds.has(org.id)} onCheckedChange={(checked) => toggle(org.id, checked)} />
										{org.name}
									</label>
								))}
							</div>
						);
					})}
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</form>
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !name.trim() || unchanged}>{pending ? "Saving…" : submitLabel}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
