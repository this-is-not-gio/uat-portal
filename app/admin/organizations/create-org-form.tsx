"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrg } from "@/lib/supabase/admin-actions";
import type { orgType } from "@/lib/supabase/organizations";

// New orgs are almost always external companies; vendor and client exist once each.
export function CreateOrgForm() {
	const [name, setName] = useState("");
	const [type, setType] = useState<orgType>("external");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	return (
		<form
			className="flex flex-wrap items-end gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				startTransition(async () => {
					const result = await createOrg({ name, type });
					setError(result.ok ? null : result.error);
					if (result.ok) setName("");
				});
			}}>
			<Input className="w-64" placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
			<select className="rounded-md border px-2 py-1 text-sm" value={type} onChange={(e) => setType(e.target.value as orgType)}>
				<option value="external">External company</option>
				<option value="client">Client</option>
				<option value="vendor">Vendor</option>
			</select>
			<Button type="submit" disabled={pending}>{pending ? "Adding..." : "Add organization"}</Button>
			{error && <p className="text-sm text-destructive">{error}</p>}
		</form>
	);
}
