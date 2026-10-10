"use client";

import { useId, useState, useTransition } from "react";
import { BuildingComplexPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrg } from "@/lib/supabase/admin-actions";
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels";
import type { orgType } from "@/lib/supabase/organizations";

// Internal first: that's the org type being set up now (External is deferred).
const TYPE_OPTIONS: orgType[] = ["client", "external", "vendor"];
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
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	function submit() {
		setError(null);
		startTransition(async () => {
			const created = await createOrg({ name, type });
			if (!created.ok) {
				setError(created.error);
				return;
			}
			onDone();
		});
	}

	return (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Create new organization</DialogTitle>
				<DialogDescription>Add an organization. Give it test roles from the Roles page.</DialogDescription>
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
			{error && <p className="text-sm text-destructive">{error}</p>}
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create organization"}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
