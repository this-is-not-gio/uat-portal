"use client"

import { useState } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { Ban, CheckCircle, CircleCheck, CircleDashed, CircleX, MoreHorizontal, MoreVertical, TestTubeDiagonal, Trash2, UserCog, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { removeParticipant } from "@/lib/supabase/iteration-actions"
import ConfirmDialog from "../confirm-dialog"
import EditParticipantRolesDialog from "@/components/testsuite-layout/test-cases/edit-participant-roles-dialog"

// One participating org in a round, shaped by IterationParticipantsTable.
export type iterationParticipantRow = {
	id: string
	name: string
	typeLabel: string
	// Test roles the org tests the suite as in this round (0054).
	roles: { id: string; name: string }[]
	testerCount: number
	tested: number
	total: number
	// Included cases by result, for the Iteration Summary chips (same buckets as the Test Results summary).
	passed: number
	failed: number
	blocked: number
	submittedAt: string | null
	// Set only while the round is planned/running — shows the Withdraw action.
	iterationId?: string
}

const columnHelper = createColumnHelper<DataTableFeatures, iterationParticipantRow>()

// Mirrors the Test Results tab's Passed / Failed / Blocked summary cards.
const SUMMARY_CHIPS = [
	{ key: "passed", label: "Passed", icon: CircleCheck, className: "bg-green-200/10 text-green-800" },
	{ key: "failed", label: "Failed", icon: CircleX, className: "bg-red-200/10 text-red-800" },
	{ key: "blocked", label: "Blocked", icon: Ban, className: "bg-gray-600/5 text-gray-800" },
] as const

// Where an org is in the round: submitted, started testing, or not started.
const PARTICIPATION_STATES = {
	submitted: { label: "Submitted Result", icon: CheckCircle, className: "bg-green-200/10 text-green-800" },
	testing: { label: "Currently Testing", icon: TestTubeDiagonal, className: "bg-blue-200/10 text-blue-800" },
	notTesting: { label: "Not Testing", icon: CircleDashed, className: "bg-gray-600/5 text-gray-800" },
} as const

export const iterationParticipantColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Organization",
		cell: (info) => (
			<div>
				<p className="text-xs">{info.getValue()}</p>
				<p className="text-xs text-muted-foreground font-mono">{info.row.original.typeLabel}</p>
			</div>
		),
	}),
	columnHelper.accessor("roles", {
		header: "Roles",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => {
			const roles = info.getValue()
			return roles.length > 0 ? (
				<div className="flex flex-row flex-wrap gap-1 max-w-64">
					{roles.map((role) => (
						<span key={role.id} className="rounded-md py-0.5 px-1.5 bg-gray-600/5 text-xs text-gray-800">{role.name}</span>
					))}
				</div>
			) : <p className="text-xs text-muted-foreground">No roles</p>
		},
	}),
	columnHelper.accessor("testerCount", {
		header: "Testers",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => <div className="flex flex-row items-center gap-1 rounded-md py-1 px-1.5 bg-gray-600/5 w-fit">
			<Users size={15} className="text-gray-800" />
			<div className="flex flex-row items-center gap-0.5">
				<p className="font-mono text-xs text-gray-800">{info.row.original.testerCount}</p>
				<p className="text-xs text-gray-800 font-semibold">Testers</p>
			</div>
		</div>,
	}),
	columnHelper.display({
		id: "progress",
		header: "Progress",
		meta: { className: "hidden lg:table-cell" },
		cell: (info) => {
			const { tested, total } = info.row.original
			const percent = total === 0 ? 0 : Math.round((tested / total) * 100)
			return (
				<div className="flex flex-row items-center gap-2">
					<div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
						<div className="h-full bg-green-600" style={{ width: `${percent}%` }} />
					</div>

					<p className="text-xs text-muted-foreground"><span className="text-xs font-mono text-muted-foreground">{tested}/{total}</span> Tested Test Cases</p>
				</div>
			)
		},
	}),
	columnHelper.display({
		id: "Iteration Summary",
		header: "Iteration Summary",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => (
			<div className="flex flex-row items-center gap-1">
				{SUMMARY_CHIPS.map(({ key, label, icon: Icon, className }) => (
					<div key={key} className={`flex flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit ${className}`}>
						<Icon size={15} />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs">{info.row.original[key]}</p>
						</div>
					</div>
				))}
			</div>
		),
	}),
	columnHelper.display({
		id: "Submitted",
		cell: (info) => {
			const { submittedAt, tested, id, name, roles, iterationId } = info.row.original
			const state = PARTICIPATION_STATES[submittedAt ? "submitted" : tested > 0 ? "testing" : "notTesting"]
			const Icon = state.icon


			return (
				<div className="flex flex-row justify-end gap-2">
					<div className="w-full flex flex-row items-center gap-1 justify-end">
						<div className={`w-fit flex flex-row items-center gap-1 rounded-md py-1 px-1.5 ${state.className}`}>
							<Icon size={15} />
							<p className="text-xs font-semibold">{state.label}</p>
						</div>
					</div>
					{
						// Rows navigate on click; React bubbles through portals, so keep menu/dialog clicks here.
						iterationId ? <div onClick={(event) => event.stopPropagation()}><ParticipantActions iterationId={iterationId} organizationId={id} organizationName={name} roleIds={roles.map((r) => r.id)} /></div> : null
					}
				</div>
			)
		},

		//{submittedAt ? format(new Date(submittedAt), "MMM dd yyyy") : "Not submitted"}
	}),
	// columnHelper.display({
	// 	id: "action",
	// 	cell: (info) => {
	// 		const { id, name, iterationId } = info.row.original
	// 		return
	// 	},
	// }),
])

// The dialog sits outside the menu so it stays open after the menu closes.
function ParticipantActions({ iterationId, organizationId, organizationName, roleIds }: { iterationId: string; organizationId: string; organizationName: string; roleIds: string[] }) {
	const [withdrawOpen, setWithdrawOpen] = useState(false)
	const [rolesOpen, setRolesOpen] = useState(false)

	return (
		<div>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${organizationName}`}>
					<MoreVertical className="h-4 w-4" />
				</Button>} />
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={() => setRolesOpen(true)}>
							<UserCog size={14} />
							Edit roles
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onClick={() => setWithdrawOpen(true)}>
							<Trash2 size={14} />
							Withdraw organization
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<EditParticipantRolesDialog
				iterationId={iterationId}
				organizationId={organizationId}
				organizationName={organizationName}
				currentRoleIds={roleIds}
				open={rolesOpen}
				onOpenChange={setRolesOpen}
			/>
			<ConfirmDialog
				open={withdrawOpen}
				onOpenChange={setWithdrawOpen}
				title={`Withdraw ${organizationName}?`}
				description="Removes this organization and its test cases from the round. Only works while it hasn't recorded any results yet."
				confirmLabel="Withdraw organization"
				onConfirm={() => removeParticipant({ iterationId, organizationId })}
			/>
		</div>
	)
}
