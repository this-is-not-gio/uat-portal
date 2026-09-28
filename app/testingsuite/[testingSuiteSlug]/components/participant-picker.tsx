"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getParticipantOptions } from "@/lib/supabase/iteration-actions";
import type { organization, orgType } from "@/lib/supabase/organizations";

export const ORG_TYPE_LABELS: Record<orgType, string> = {
	vendor: "Vendor",
	client: "Client",
	external: "External company",
};

// Which cases each kind of org gets, mirroring org_sees_audience (0007).
const ORG_TYPE_HINTS: Record<orgType, string> = {
	vendor: "Runs its own pass alongside the client",
	client: "Tests internal & shared cases",
	external: "Tests external & shared cases",
};

// The orgs selected when the picker first loads: the client org(s), matching
// start_iteration's fallback when p_org_ids is null.
function defaultSelection(organizations: organization[]): string[] {
	const initialOrganizations = organizations.filter((o) => o.type === "client");

	return initialOrganizations.map((o) => o.id);
}

// "Participating organizations" multi-select for Start Iteration. Each picked org
// gets its own result rows, filtered by the cases' audience.
export default function ParticipantPicker({
	onChange,
	disabled,
}: {
	onChange: (next: string[]) => void;
	disabled?: boolean;
}) {
	const [organizations, setOrganizations] = useState<organization[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [orgIds, setOrgIds] = useState<string[]>([]);

	useEffect(() => {
		let cancelled = false;
		getParticipantOptions().then((result) => {
			if (cancelled) return;
			if (!result.ok) {
				setError(result.error);
				return;
			}
			const initial = defaultSelection(result.data.organizations);
			setOrganizations(result.data.organizations);
			setOrgIds(initial);
			onChange(initial);
		});
		return () => { cancelled = true; };
		// onChange is a state setter from the dialog; loading once per mount is intended.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function pick(ids: string[]) {
		setOrgIds(ids);
		onChange(ids);
	}

	if (error) return <p className="text-xs text-destructive">{error}</p>;
	if (!organizations) return <p className="text-xs text-muted-foreground">Loading organizations…</p>;

	const selected = organizations.filter((o) => orgIds.includes(o.id));

	return (
		<div className="flex flex-col gap-1">
			<Label className="text-xs text-muted-foreground">Participating organizations</Label>
			<Select multiple value={orgIds} onValueChange={pick} disabled={disabled}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Choose organizations">
						{selected.length === 0
							? undefined
							: selected.length === 1
								? selected[0].name
								: `${selected.length} organizations selected`}
					</SelectValue>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					{organizations.map((org) => (
						<SelectItem key={org.id} value={org.id}>
							<div className="flex flex-col">
								<p className="text-sm">{org.name}</p>
								<p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type]} · {ORG_TYPE_HINTS[org.type]}</p>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{selected.length > 0 && (
				<p className="text-xs text-muted-foreground">
					Each organization records its own results for the cases meant for it.
				</p>
			)}
		</div>
	);
}
