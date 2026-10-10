"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameOrg } from "@/lib/supabase/admin-actions";
import type { organization } from "@/lib/supabase/organizations";

export function OrgNameEditor({ org }: { org: organization }) {
	const [name, setName] = useState(org.name);
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const dirty = name.trim() !== org.name;

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				startTransition(async () => {
					const result = await renameOrg({ id: org.id, name });
					setError(result.ok ? null : result.error);
				});
			}}>
			<Input className="h-8 w-56" value={name} onChange={(e) => setName(e.target.value)} required />
			{dirty && <Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>}
			{error && <span className="text-sm text-destructive">{error}</span>}
		</form>
	);
}
