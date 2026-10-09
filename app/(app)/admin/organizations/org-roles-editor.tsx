"use client";

import { useState, useTransition } from "react";
import { Plus, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrgRole, deleteOrgRole, renameOrg } from "@/lib/supabase/admin-actions";
import type { organization, orgRole } from "@/lib/supabase/organizations";

// Role Assignee values offered as suggestions, so a role's name lines up with the test cases
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

export function OrgRolesEditor({ organizationId, roles }: { organizationId: string; roles: orgRole[] }) {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) =>
		startTransition(async () => {
			const result = await action();
			setError(result.ok ? null : result.error);
			if (result.ok) onOk?.();
		});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap gap-1">
				{roles.length === 0 && <span className="text-sm text-muted-foreground">No roles yet</span>}
				{roles.map((role) => (
					<Badge key={role.id} variant="secondary" className="gap-1 pr-1">
						{role.name}
						<button
							type="button"
							aria-label={`Remove ${role.name}`}
							className="rounded-sm opacity-60 hover:opacity-100 disabled:pointer-events-none"
							disabled={pending}
							onClick={() => {
								if (confirm(`Remove "${role.name}"? Users with this role keep their organization but lose the role.`))
									run(() => deleteOrgRole({ id: role.id }));
							}}>
							<XIcon className="size-3" />
						</button>
					</Badge>
				))}
			</div>
			<form
				className="flex items-center gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					run(() => createOrgRole({ organizationId, name }), () => setName(""));
				}}>
				<Input className="h-8 w-full" placeholder="Add role" value={name} onChange={(e) => setName(e.target.value)} required />
				<Button size="sm" variant="outline" type="submit" disabled={pending}><Plus/>Add Role</Button>
				{error && <span className="text-sm text-destructive">{error}</span>}
			</form>
		</div>
	);
}
