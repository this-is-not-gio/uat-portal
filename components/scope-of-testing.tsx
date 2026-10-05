import { ClipboardList, TestTube2, UserGroup } from "lucide-react";
import { AUDIENCE_ICONS, AUDIENCE_LABELS } from "@/components/audience-badge";
import type { suiteScope } from "@/lib/supabase/test-suite";

const pluralWord = (count: number, word: string) => `${word}${count === 1 ? "" : "s"}`;

// "Scope of Testing": what the suite covers (sections, cases, roles, audience).
// Shown in the suite header (right-aligned) and the Overview title (left-aligned).
export function ScopeOfTesting({ scope, align = "end" }: { scope: suiteScope; align?: "start" | "end" }) {
	return (
		<div className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
			<p className="text-xs text-muted-foreground">Scope of Testing</p>
			<div className="flex flex-row items-center gap-1">
				{[
					{ key: "sections", Icon: ClipboardList, count: scope.sectionCount, label: pluralWord(scope.sectionCount, "Section") },
					{ key: "cases", Icon: TestTube2, count: scope.testCaseCount, label: pluralWord(scope.testCaseCount, "Test Case") },
					{ key: "roles", Icon: UserGroup, count: scope.roleCount, label: pluralWord(scope.roleCount, "Role") },
				].map(({ key, Icon, count, label }) => (
					<div key={key} className="flex flex-row items-center gap-1 rounded-md py-1.5 px-2 bg-gray-600/5 w-fit text-gray-800">
						<Icon size={15} />
						<div className="flex flex-row items-center gap-0.5">
							<p className="font-mono text-xs">{count}</p>
							<p className="text-xs font-semibold">{label}</p>
						</div>
					</div>
				))}
				{scope.audience && (() => {
					const AudienceIcon = AUDIENCE_ICONS[scope.audience];
					return (
						<div className="flex flex-row items-center gap-1 rounded-md py-1.5 px-2 bg-gray-600/5 w-fit text-gray-800">
							<AudienceIcon size={15} />
							<p className="text-xs font-semibold">{AUDIENCE_LABELS[scope.audience]}</p>
						</div>
					);
				})()}
			</div>
		</div>
	);
}
