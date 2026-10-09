"use client";

import { useId, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteUser } from "@/lib/supabase/admin-actions";
import type { organization, orgRole } from "@/lib/supabase/organizations";
import { ROLES, orgsForRole, type roleOrgValue } from "../role-org-fields";

const NONE = "__none__";

export function InviteParticipantDialog({ organizations, roles }: { organizations: organization[]; roles: orgRole[] }) {
	const [open, setOpen] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
				<UserPlus />
				<p className="text-xs font-medium">Invite new participant</p>
			</DialogTrigger>
			{/* Remounted on open so each invite starts from an empty form. */}
			{open && <InviteForm organizations={organizations} roles={roles} onDone={() => setOpen(false)} />}
		</Dialog>
	);
}

function InviteForm({ organizations, roles, onDone }: { organizations: organization[]; roles: orgRole[]; onDone: () => void }) {
	const formId = useId();
	const [email, setEmail] = useState("");
	const [fullName, setFullName] = useState("");
	// Internal first: that's who is being onboarded now.
	const [roleOrg, setRoleOrg] = useState<roleOrgValue>(() => ({
		role: "Internal",
		organizationId: orgsForRole(organizations, "Internal")[0]?.id ?? "",
		orgRoleId: null,
	}));
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	// The org list follows the access role, and the test role list follows the org.
	const orgOptions = orgsForRole(organizations, roleOrg.role);
	const orgRoles = roles.filter((r) => r.organizationId === roleOrg.organizationId);
	const orgName = orgOptions.find((org) => org.id === roleOrg.organizationId)?.name;
	const testRoleName = orgRoles.find((r) => r.id === roleOrg.orgRoleId)?.name;

	return (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Invite new participant</DialogTitle>
				<DialogDescription>They get an email invite to set their password and sign in.</DialogDescription>
			</DialogHeader>
			<form
				id={formId}
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					setError(null);
					startTransition(async () => {
						const result = await inviteUser({ email, fullName, ...roleOrg });
						if (!result.ok) {
							setError(result.error);
							return;
						}
						onDone();
					});
				}}>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor={`${formId}-name`} className="text-xs">Full name</Label>
						<Input id={`${formId}-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-xs md:text-xs" required />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor={`${formId}-email`} className="text-xs">Email</Label>
						<Input id={`${formId}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs md:text-xs" required />
					</div>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Access role</Label>
						<Select
							value={roleOrg.role}
							onValueChange={(value) => {
								if (!value) return;
								const role = value as roleOrgValue["role"];
								setRoleOrg({ role, organizationId: orgsForRole(organizations, role)[0]?.id ?? "", orgRoleId: null });
							}}>
							<SelectTrigger className="w-full text-xs">
								<SelectValue>{roleOrg.role}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								{ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Organization</Label>
						<Select
							value={roleOrg.organizationId}
							onValueChange={(value) => value && setRoleOrg({ ...roleOrg, organizationId: value, orgRoleId: null })}>
							<SelectTrigger className="w-full text-xs" disabled={!orgOptions.length}>
								<SelectValue>{orgName ?? "No organizations of this type"}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								{orgOptions.map((org) => <SelectItem key={org.id} value={org.id} className="text-xs">{org.name}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
				</div>
				{orgRoles.length > 0 && (
					<div className="flex flex-col gap-2">
						<Label className="text-xs">Test role</Label>
						<Select
							value={roleOrg.orgRoleId ?? NONE}
							onValueChange={(value) => setRoleOrg({ ...roleOrg, orgRoleId: !value || value === NONE ? null : value })}>
							<SelectTrigger className="w-full text-xs">
								<SelectValue>{testRoleName ?? "No test role"}</SelectValue>
							</SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<SelectItem value={NONE} className="text-xs">No test role</SelectItem>
								{orgRoles.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
				)}
				{error && <p className="text-sm text-destructive">{error}</p>}
			</form>
			<DialogFooter>
				<DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
				<Button type="submit" form={formId} disabled={pending || !roleOrg.organizationId}>{pending ? "Sending…" : "Send invite"}</Button>
			</DialogFooter>
		</DialogContent>
	);
}
