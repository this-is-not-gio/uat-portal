"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { adminUser } from "@/lib/supabase/admin-actions"
import type { orgRole } from "@/lib/supabase/organizations"
import { ORG_TYPE_LABELS } from "@/lib/org-type-labels"
import { humanizeTimestamp } from "@/lib/utils"
import { ParticipantActions } from "@/app/(app)/admin/users/participant-actions"


const columnHelper = createColumnHelper<DataTableFeatures, adminUser>()

// The actions column edits a user's test role, so it needs the role list to pick from.
export function participantColumns(roles: orgRole[]) {
	return columnHelper.columns([
		columnHelper.accessor("fullName", {
			header: "Participant",
			cell: (info) => (
				<div>
					<p className="text-xs font-medium">{info.getValue() || "—"}</p>
					<p className="text-xs text-muted-foreground">{info.row.original.email ?? "—"}</p>
				</div>
			),
		}),
		columnHelper.accessor((user) => user.organization?.name ?? "", {
			id: "organization",
			header: "Organization",
			cell: (info) => {
				const org = info.row.original.organization
				return org ? (
					<div>
						<p className="text-xs font-semibold">{org.name} - <span className="font-mono text-muted-foreground">{ORG_TYPE_LABELS[org.type]}</span></p>
					</div>
				) : "—"
			},
		}),
		columnHelper.accessor((user) => user.orgRole?.name ?? "", {
			id: "testRole",
			header: "Test role",
			cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>,
		}),
		columnHelper.accessor("lastSignInAt", {
			header: "Last sign-in",
			meta: { className: "hidden lg:table-cell" },
			cell: (info) => {
				const user = info.row.original
				return user.lastSignInAt
					? humanizeTimestamp(user.lastSignInAt)
					: user.invitedAt ? "Invited, not signed in" : "Never"
			},
		}),
		columnHelper.display({
			id: "access",
			cell: (info) => <ParticipantActions user={info.row.original} roles={roles} />,
		})
	])
}
