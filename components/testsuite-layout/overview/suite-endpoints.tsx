"use client";

import { useState, useTransition } from "react";
import { Link, Plus, Save, Settings, Tag, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { suiteEndpoint } from "@/lib/supabase/test-accounts";
import { TooltipContent, TooltipTrigger, Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { saveSuiteOverview } from "@/lib/supabase/authoring-actions";

export type endpointRow = { key: string; name: string; url: string };
export const emptyEndpoint = (): endpointRow => ({ key: crypto.randomUUID(), name: "", url: "" });

// Sidebar "Endpoints": name + URL per endpoint (URLs open in a new tab). The
// settings button (editors only) opens the endpoints editor: a dialog on wide
// screens, a right-side sheet on mobile.
export function SuiteEndpointsList({ suiteId, endpoints, canEdit }: { suiteId: string; endpoints: suiteEndpoint[]; canEdit: boolean }) {
	return (
		<div className="flex flex-col gap-4 py-6 border-b">
			<div className="flex flex-row justify-between">
				<div className="flex flex-row gap-2 items-center">
					<Link className="size-4 text-accent-foreground" />
					<p className="font-semibold">Endpoints</p>
				</div>
				{canEdit && <EndpointsDialog suiteId={suiteId} endpoints={endpoints} />}
			</div>
			{endpoints.length === 0 ? (
				<p className="text-xs text-muted-foreground">No endpoints yet.</p>
			) : (
				<div className="flex flex-col gap-3">
					{endpoints.map((endpoint) => (
						<div key={endpoint.id} className="flex flex-col gap-1 min-w-0">
							<div className="flex flex-row items-center gap-2 min-w-0">
								<Link className="size-3 shrink-0 text-accent-foreground" />
								<a href={endpoint.url} target="_blank" rel="noreferrer" className="font-semibold font-mono text-sm truncate hover:underline" title={endpoint.url}>{endpoint.url}</a>
							</div>
							<p className="text-xs">{endpoint.name}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function EndpointsDialog({ suiteId, endpoints }: { suiteId: string; endpoints: suiteEndpoint[] }) {
	const isMobile = useIsMobile();
	const [open, setOpen] = useState(false);
	const [rows, setRows] = useState<endpointRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Each open starts from the saved endpoints.
	function onOpenChange(next: boolean) {
		if (isPending) return;
		if (next) {
			setRows(endpoints.map((e) => ({ key: e.id, name: e.name, url: e.url })));
			setError(null);
		}
		setOpen(next);
	}

	// Blank rows are dropped; half-filled ones block the save.
	function save() {
		const next = rows.filter((r) => r.name.trim() || r.url.trim()).map((r) => ({ name: r.name.trim(), url: r.url.trim() }));
		if (next.some((e) => !e.name || !e.url)) {
			setError("Every endpoint needs a name and a URL.");
			return;
		}
		if (JSON.stringify(next) === JSON.stringify(endpoints.map(({ name, url }) => ({ name, url })))) {
			setOpen(false);
			return;
		}
		startTransition(async () => {
			const result = await saveSuiteOverview({ suiteId, endpoints: next });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setOpen(false);
		});
	}

	const cogButton = (
		<Button variant="ghost" size="icon" className="text-accent-foreground" aria-label="Configure Endpoints">
			<Settings className="size-4" />
		</Button>
	);
	const titleContent = (
		<>
			<Link className="text-accent-foreground size-4" />
			Configure Endpoints
		</>
	);
	const description = "Add the URLs testers will use, each with a name.";
	const editor = <SuiteEndpointsEditor rows={rows} onRowsChange={setRows} disabled={isPending} />;
	const actions = (
		<>
			{error && <p className="text-xs text-destructive sm:mr-auto">{error}</p>}
			<Button className="text-xs" type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
			<Button className="text-xs" type="button" onClick={save} disabled={isPending}>
				<Save className="size-4" />
				{isPending ? "Saving…" : "Save Endpoints"}
			</Button>
		</>
	);

	// Same state and editor either way; only the container changes with the screen size.
	if (isMobile) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetTrigger render={cogButton} />
				<SheetContent side="right" className="data-[side=right]:w-full">
					<SheetHeader>
						<SheetTitle className="flex flex-row gap-2 items-center">{titleContent}</SheetTitle>
						<SheetDescription className="text-xs">{description}</SheetDescription>
					</SheetHeader>
					<div className="flex-1 min-h-0 overflow-y-auto px-4">{editor}</div>
					<SheetFooter>{actions}</SheetFooter>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Tooltip>
				<TooltipTrigger render={<DialogTrigger render={cogButton} />} />
				<TooltipContent side="bottom" className="text-xs">Configure Endpoints</TooltipContent>
			</Tooltip>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex flex-row gap-2 items-center">{titleContent}</DialogTitle>
					<DialogDescription className="text-xs">{description}</DialogDescription>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-y-auto">{editor}</div>
				<DialogFooter className="sm:items-center">{actions}</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function SuiteEndpointsEditor({ rows, onRowsChange, disabled }: { rows: endpointRow[]; onRowsChange: (rows: endpointRow[]) => void; disabled?: boolean }) {
	function updateRow(key: string, patch: Partial<endpointRow>) {
		onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
	}
	const addButton = (
		<Button type="button" variant="outline" className="text-xs flex flex-row gap-2 items-center w-fit" disabled={disabled} onClick={() => onRowsChange([...rows, emptyEndpoint()])}>
			<Plus className="size-4" />
			<p>Add Endpoint</p>
		</Button>
	);

	return (
		<div className="flex flex-col gap-3">
			{rows.map((row) => (
				<FieldGroup key={row.key} className="gap-4 flex flex-col sm:flex-row sm:items-end border p-4 rounded-md">
					<Field className="w-full sm:w-64 sm:shrink-0">
						<div className="flex flex-row gap-1 items-center">
							<Tag className="text-muted-foreground size-4" />
							<FieldLabel htmlFor={`endpoint-name-${row.key}`} className="text-xs font-medium text-muted-foreground">Name</FieldLabel>
						</div>
						<Input className="text-xs md:text-sm" id={`endpoint-name-${row.key}`} placeholder="e.g. Staging App" autoComplete="off" disabled={disabled} value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value })} />
					</Field>
					<Field>
						<div className="flex flex-row gap-1 items-center">
							<Link className="text-muted-foreground size-4" />
							<FieldLabel htmlFor={`endpoint-url-${row.key}`} className="text-xs font-medium text-muted-foreground">URL</FieldLabel>
						</div>
						<Input className="font-mono text-xs md:text-sm" id={`endpoint-url-${row.key}`} type="url" placeholder="https://staging.example.com" autoComplete="off" disabled={disabled} value={row.url} onChange={(e) => updateRow(row.key, { url: e.target.value })} />
					</Field>
					<Button type="button" size="icon" variant="destructive" aria-label="Remove endpoint" disabled={disabled} onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}>
						<Trash className="size-4" />
					</Button>
				</FieldGroup>
			))}
			{rows.length === 0 ? (
				<div className="flex flex-col items-center gap-3 border border-dashed rounded-md py-6">
					<EmptyState icon={Link} size="sm" title="No endpoints yet" description="Add the environments or APIs testers need." />
					{addButton}
				</div>
			) : addButton}
		</div>
	);
}
