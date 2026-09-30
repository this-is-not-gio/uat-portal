import { listUsers } from "@/lib/supabase/admin-actions";
import { getOrganizations } from "@/lib/supabase/organizations";
import { InviteUserForm } from "./invite-user-form";
import { UserRoleEditor } from "./user-role-editor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminUsersPage() {
	const [users, organizations] = await Promise.all([listUsers(), getOrganizations()]);

	return (
		<>
			<h1 className="text-xl font-semibold">Users</h1>
			<InviteUserForm organizations={organizations} />
			{users.ok ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role / organization</TableHead>
							<TableHead>Last sign-in</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.data.map((user) => (
							<TableRow key={user.id}>
								<TableCell>{user.fullName || "—"}</TableCell>
								<TableCell>{user.email ?? "—"}</TableCell>
								<TableCell>
									<UserRoleEditor user={user} organizations={organizations} />
								</TableCell>
								<TableCell>
									{user.lastSignInAt
										? new Date(user.lastSignInAt).toLocaleDateString()
										: user.invitedAt ? "Invited, not signed in" : "Never"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="text-sm text-destructive">{users.error}</p>
			)}
		</>
	);
}
