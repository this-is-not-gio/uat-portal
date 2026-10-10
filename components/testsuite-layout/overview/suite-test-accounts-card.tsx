"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useState } from "react";
import { ClipboardIcon, Eye, EyeOff, IdCard, Key, Plus, ShieldUser, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleOptionGroups, roleNameOf } from "@/components/testsuite-layout/shared/test-role-options";
import type { testRoleOptions } from "@/lib/supabase/organizations";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { suiteTestAccount } from "@/lib/supabase/test-accounts";
import { createColumnHelper } from "@tanstack/react-table";
import { type DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// testRoleId: a catalog role (test_roles) ID, or null for "any role"; role: its saved name.
export type accountRow = { key: string; testRoleId: string | null; role: string | null; username: string; password: string };
export const emptyRow = (): accountRow => ({ key: crypto.randomUUID(), testRoleId: null, role: null, username: "", password: "" });

const columnHelper = createColumnHelper<DataTableFeatures, suiteTestAccount>();

const columns = columnHelper.columns([
	columnHelper.accessor("role", {
		header: "Test Role",
		cell: (info) => <p className="text-xs font-medium">{info.getValue() || "Any role"}</p>,
	}),
	columnHelper.accessor("username", {
		header: "Username/Email",
		cell: (info) => <div className="w-full flex flex-row gap-2 items-center justify-between">
			<p className="font-mono text-xs">{info.getValue()}</p>
			<CopyButton value={info.getValue()} label="username" />
		</div>,
	}),
	columnHelper.accessor("password", {
		header: "Password",
		cell: (info) => <PasswordCell password={info.getValue()} />,
	}),
]);

// Copies one credential field. The toast confirms without echoing the value,
// so credentials don't flash on a shared screen. Hidden when there's nothing to copy.
function CopyButton({ value, label }: { value: string; label: string }) {
	if (!value) return null;
	const title = label.charAt(0).toUpperCase() + label.slice(1);
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${title} copied`);
		} catch {
			// Clipboard API needs a secure context (https/localhost) and permission.
			toast.error(`Couldn't copy ${label} — copy it manually`);
		}
	}
	return (
		<Tooltip>
			<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={copy}>
				<ClipboardIcon className="size-4" />
			</Button>} />
			<TooltipContent side="top" className="w-fit">
				<p className="text-xs">Copy {label}</p>
			</TooltipContent>
		</Tooltip>
	);
}

// Masked with a fixed-length mask (doesn't leak the length) until this row is revealed.
function PasswordCell({ password }: { password: string }) {
	const [revealed, setRevealed] = useState(false);
	return (
		<div className="w-full flex flex-row gap-2 items-center justify-between">
			<p className="font-mono text-xs">{revealed ? password : password && "••••••••"}</p>
			{password && (
				<div className="flex flex-row gap-1">
					<Button type="button" variant="ghost" size="icon" aria-label={revealed ? "Hide password" : "Show password"} onClick={() => setRevealed(!revealed)}>
						{revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
					</Button>
					<CopyButton value={password} label="password" />
				</div>
			)}
		</div>
	);
}

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

export function SuiteTestAccountsEditor({ rows, onRowsChange, roleOptions, disabled }: { rows: accountRow[]; onRowsChange: (rows: accountRow[]) => void; roleOptions: testRoleOptions; disabled?: boolean }) {
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
						<Select value={row.testRoleId} onValueChange={(value) => updateRow(row.key, { testRoleId: value as string | null })} disabled={disabled}>
							<SelectTrigger className="w-full" aria-label="Role"><SelectValue placeholder="Select role">{roleNameOf(roleOptions, row.testRoleId, row.role)}</SelectValue></SelectTrigger>
							<SelectContent alignItemWithTrigger={false}>
								<RoleOptionGroups options={roleOptions} current={row.testRoleId && row.role ? { id: row.testRoleId, name: row.role } : null} />
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
