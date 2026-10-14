"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { Ban, CheckCircle, CircleCheck, CircleX, Hourglass } from "lucide-react"
import { BADGE_VARIANTS } from "@/components/sidebar/app-sidebar"
import { cn, initials } from "@/lib/utils"

// One rostered tester in a round, shaped by IterationParticipantsTable.
export type iterationParticipantRow = {
	// The tester's user id.
	id: string
	name: string
	roleName: string
	organizationId: string
	organizationName: string
	organizationType: string
	tested: number
	total: number
	// Their included cases by result, for the Iteration Summary chips (same buckets as the Test Results summary).
	passed: number
	failed: number
	blocked: number
	submittedAt: string | null
}

const columnHelper = createColumnHelper<DataTableFeatures, iterationParticipantRow>()

// Mirrors the Test Results tab's Passed / Failed / Blocked summary cards.
const SUMMARY_CHIPS = [
	{ key: "passed", label: "Passed", icon: CircleCheck, className: "bg-green-200/10 text-green-800" },
	{ key: "failed", label: "Failed", icon: CircleX, className: "bg-red-200/10 text-red-800" },
	{ key: "blocked", label: "Blocked", icon: Ban, className: "bg-gray-600/5 text-gray-800" },
] as const

// Whether the tester's org has handed in its results yet.
const SUBMISSION_STATES = {
	submitted: { label: "Submitted", icon: CheckCircle, className: "bg-green-200/10 text-green-800" },
	awaiting: { label: "Awaiting Response", icon: Hourglass, className: "bg-gray-600/5 text-gray-800" },
} as const

export const iterationParticipantColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		header: "Tester",
		cell: (info) => 
		<div className="flex flex-row items-center gap-2">
			<div className={cn("size-8 shrink-0 rounded-full flex items-center justify-center", (BADGE_VARIANTS[info.row.original.organizationType as keyof typeof BADGE_VARIANTS] ?? BADGE_VARIANTS.fallback).UserClassName)}>
				<p className="text-xs font-bold text-white">{initials(info.getValue())}</p>
			</div>
			<div className="flex flex-col gap-0">
				<p className="text-xs font-semibold">{info.getValue()}</p>
				<p className="text-xs text-muted-foreground font-mono">{info.row.original.organizationName}</p>
			</div>
		</div>
	}),
	columnHelper.display({
		id: "role",
		header: "Role",
		meta: { className: "hidden md:table-cell" },
		cell: (info) => (
			<div>
				<p className="text-xs">{info.row.original.roleName}</p>
			</div>
		),
	}),
	columnHelper.display({
		id: "progress",
		header: "Test Cases",
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
					<div key={key} title={label} className={`flex flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit ${className}`}>
						<Icon size={15} />
						<p className="font-mono text-xs">{info.row.original[key]}</p>
					</div>
				))}
			</div>
		),
	}),
	columnHelper.display({
		id: "Submitted",
		cell: (info) => {
			const state = SUBMISSION_STATES[info.row.original.submittedAt ? "submitted" : "awaiting"]
			const Icon = state.icon
			return (
				<div className="flex flex-row items-center gap-1 justify-end">
					<div className={`w-fit flex flex-row items-center gap-1 rounded-md py-1 px-1.5 ${state.className}`}>
						<Icon size={15} />
						<p className="text-xs font-semibold">{state.label}</p>
					</div>
				</div>
			)
		},
	}),
])
