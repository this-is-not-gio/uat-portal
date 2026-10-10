"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { orgRole } from "@/lib/supabase/organizations";

// Which of an org's test roles (/admin) test the suite in a round. Used when adding a
// participant and when changing its roles; the org gets the cases whose Role Assignee
// is one of the checked roles.
export default function ParticipantRoleChecklist({
	roles,
	checked,
	onChange,
	disabled,
}: {
	roles: orgRole[];
	checked: Set<string>;
	onChange: (next: Set<string>) => void;
	disabled?: boolean;
}) {
	if (roles.length === 0) {
		return <p className="text-xs text-muted-foreground">No test roles yet. Add them in Admin → Roles.</p>;
	}

	function toggle(id: string, on: boolean) {
		const next = new Set(checked);
		if (on) next.add(id); else next.delete(id);
		onChange(next);
	}

	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-xs text-muted-foreground">Roles testing this suite</p>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
				{roles.map((role) => (
					<label key={role.id} className="flex items-center gap-2 text-xs cursor-pointer">
						<Checkbox
							checked={checked.has(role.id)}
							onCheckedChange={(on) => toggle(role.id, on === true)}
							disabled={disabled}
						/>
						{role.name}
					</label>
				))}
			</div>
			{checked.size === 0 && <p className="text-xs text-destructive">Pick at least one role.</p>}
		</div>
	);
}
