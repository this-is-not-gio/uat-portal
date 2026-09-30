"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser } from "@/lib/supabase/admin-actions";
import type { organization } from "@/lib/supabase/organizations";
import type { currentUser } from "@/lib/supabase/auth";
import { RoleOrgFields, orgsForRole } from "../role-org-fields";

export function InviteUserForm({ organizations }: { organizations: organization[] }) {
	const [email, setEmail] = useState("");
	const [fullName, setFullName] = useState("");
	const [roleOrg, setRoleOrg] = useState<{ role: currentUser["role"]; organizationId: string }>(() => ({
		role: "External",
		organizationId: orgsForRole(organizations, "External")[0]?.id ?? "",
	}));
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
	const [pending, startTransition] = useTransition();

	return (
		<form
			className="flex flex-wrap items-end gap-2"
			onSubmit={async (e) => {
				e.preventDefault();
				await startTransition(async () => {
					const result = await inviteUser({ email, fullName, ...roleOrg });
					setMessage(result.ok ? { ok: true, text: `Invite sent to ${email}.` } : { ok: false, text: result.error });
					if (result.ok) {
						setEmail("");
						setFullName("");
					}
				});
			}}>
			<Input className="w-56" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
			<Input className="w-48" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
			<RoleOrgFields {...roleOrg} organizations={organizations} onChange={setRoleOrg} />
			<Button type="submit" disabled={pending || !roleOrg.organizationId}>{pending ? "Sending..." : "Invite"}</Button>
			{message && <p className={message.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{message.text}</p>}
		</form>
	);
}
