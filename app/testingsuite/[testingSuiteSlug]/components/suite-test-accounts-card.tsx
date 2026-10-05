"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { IdCard, Key, Plus, ShieldUser, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/database.types";
import { Constants } from "@/lib/supabase/database.types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { suiteTestAccount } from "@/lib/supabase/test-accounts";
import { createColumnHelper } from "@tanstack/react-table";
import { type DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";

type roleAssignee = Database["public"]["Enums"]["role_assignee_type"];
export type accountRow = { key: string; role: roleAssignee | null; username: string; password: string };
export const emptyRow = (): accountRow => ({ key: crypto.randomUUID(), role: null, username: "", password: "" });

const columnHelper = createColumnHelper<DataTableFeatures, suiteTestAccount>();

const columns = columnHelper.columns([
	columnHelper.accessor("role", {
		header: "Role",
		cell: (info) => <p className="text-sm">{info.getValue() || "Any role"}</p>,
	}),
	columnHelper.accessor("username", {
		header: "Username/Email",
		cell: (info) => <p className="font-mono text-xs">{info.getValue()}</p>,
	}),
	columnHelper.accessor("password", {
		header: "Password",
		cell: (info) => <p className="font-mono text-xs">{info.getValue()}</p>,
	}),
]);

// Overview "Test Accounts". The card renders nothing when there are no
// accounts; the editor shows in the Overview's edit mode (SuiteOverviewContent).
export function SuiteTestAccountsCard({ accounts }: { accounts: suiteTestAccount[] }) {
	if (accounts.length === 0) return null;
	return (
		<div className="flex flex-col gap-2 w-full">
			<div className="flex flex-row gap-2 items-center">
				<IdCard className="text-accent-foreground size-4" />
				<p className="font-semibold">Test Accounts</p>
			</div>
			<DataTable columns={columns} data={accounts} notEnd />
		</div>
	);
}

export function SuiteTestAccountsEditor({ rows, onRowsChange, disabled }: { rows: accountRow[]; onRowsChange: (rows: accountRow[]) => void; disabled?: boolean }) {
	function updateRow(key: string, patch: Partial<accountRow>) {
		onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
	}
	const addButton = (
		<Button type="button" variant="outline" className="text-xs flex flex-row gap-2 items-center w-fit" disabled={disabled} onClick={() => onRowsChange([...rows, emptyRow()])}>
			<Plus className="size-4" />
			<p>Add Account Row</p>
		</Button>
	);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1 w-full">
				<div className="flex flex-row gap-2 items-center">
					<IdCard className="text-accent-foreground size-4" />
					<p className="font-semibold">Test Accounts</p>
				</div>
				<p className="text-xs text-muted-foreground">Add test accounts for this test suite.</p>
			</div>
			{rows.map((row) => (
				<FieldGroup key={row.key} className="gap-4 flex flex-row items-end border p-4 rounded-md">
					<Field>
						<div className="flex flex-row gap-1 items-center">
							<ShieldUser className="text-muted-foreground size-4" />
							<FieldLabel className="text-xs font-medium text-muted-foreground">Role</FieldLabel>
						</div>
						<Select value={row.role} onValueChange={(value) => updateRow(row.key, { role: value as roleAssignee | null })} disabled={disabled}>
							<SelectTrigger className="w-full" aria-label="Role"><SelectValue placeholder="Select role" /></SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								{Constants.public.Enums.role_assignee_type.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<div className="flex flex-row gap-1 items-center">
							<IdCard className="text-muted-foreground size-4" />
							<FieldLabel className="text-xs font-medium text-muted-foreground">Username/Email</FieldLabel>
						</div>
						<Input className="font-mono" id={`account-username-${row.key}`} aria-label="Username or Email" placeholder="Username or Email" autoComplete="off" disabled={disabled} value={row.username} onChange={(e) => updateRow(row.key, { username: e.target.value })} />
					</Field>
					<Field>
						<div className="flex flex-row gap-1 items-center">
							<Key className="text-muted-foreground size-4" />
							<FieldLabel className="text-xs font-medium text-muted-foreground">Password</FieldLabel>
						</div>
						<Input className="font-mono" id={`account-password-${row.key}`} aria-label="Password" placeholder="Account Password" autoComplete="off" disabled={disabled} value={row.password} onChange={(e) => updateRow(row.key, { password: e.target.value })} />
					</Field>
					<Button type="button" size="icon" variant="destructive" aria-label="Remove row" disabled={disabled} onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}>
						<Trash className="size-4" />
					</Button>
				</FieldGroup>
			))}
			{rows.length === 0 ? (
				<div className="flex flex-col items-center gap-3 border border-dashed rounded-md py-6">
					<EmptyState icon={IdCard} size="sm" title="No test accounts yet" description="Add the accounts testers will log in with." />
					{addButton}
				</div>
			) : addButton}
		</div>
	);
}
