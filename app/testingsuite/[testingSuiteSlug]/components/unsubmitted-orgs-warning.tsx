import type { organization } from "@/lib/supabase/organizations";

// 6.2: Complete round and Sign off warn about testing orgs that haven't submitted, but don't
// block (same call as D2). Completing locks everyone's rows as they stand.
export default function UnsubmittedOrgsWarning({
	organizations,
	context,
}: {
	organizations: organization[];
	context: "complete" | "sign-off";
}) {
	if (organizations.length === 0) return null;
	const many = organizations.length > 1;
	return (
		<div className="text-sm rounded-md border border-amber-600/40 bg-amber-50 text-amber-800 p-3 flex flex-col gap-1">
			<p>
				{organizations.length} {many ? "organizations haven't" : "organization hasn't"} submitted {context === "complete" ? "their results yet" : "their results for this round"}:
			</p>
			<ul className="list-disc pl-5 text-xs">
				{organizations.map((org) => <li key={org.id}>{org.name}</li>)}
			</ul>
			<p className="text-xs">
				{context === "complete"
					? "Completing the round locks their results as they stand."
					: "Their results are counted as they were when the round closed."}
			</p>
		</div>
	);
}
