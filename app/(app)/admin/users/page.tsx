import { listUsers } from "@/lib/supabase/admin-actions";
import { getOrganizationRoles, getOrganizations } from "@/lib/supabase/organizations";
import { InviteUserForm } from "./invite-user-form";
import { UserRoleEditor } from "./user-role-editor";
import { ParticipantsList } from "./participants-list";
import { InviteParticipantDialog } from "./invite-participant-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
	const [users, organizations, roles] = await Promise.all([listUsers(), getOrganizations(), getOrganizationRoles()]);

	return (
		<>
			<div className="px-2 flex flex-col gap-4">
				<div className="flex flex-row justify-between items-center">
					<div className="flex flex-col gap-1">
						<div className="flex flex-row gap-2 items-center">
							<Users className="size-5 " />
							<p className="text-sm font-semibold">Participants</p>
						</div>
						<p className="text-xs text-muted-foreground">This is where you can manage participants. Invite new users or edit existing ones.</p>
					</div>
					<InviteParticipantDialog organizations={organizations} roles={roles} />
				</div>
				{users.ok ? (
					<ParticipantsList users={users.data} organizations={organizations} roles={roles} />
				) : (
					<p className="text-sm text-destructive">{users.error}</p>
				)}
			</div>
		</>
	);
}
