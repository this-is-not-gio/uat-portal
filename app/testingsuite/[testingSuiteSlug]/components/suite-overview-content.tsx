"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { saveSuiteOverview } from "@/lib/supabase/authoring-actions";
import type { suiteOverviewSection, suiteTestAccount } from "@/lib/supabase/test-accounts";
import { SuiteDescriptionCard, SuiteDescriptionEditor } from "./suite-description-card";
import { SuiteTestAccountsCard, SuiteTestAccountsEditor, type accountRow } from "./suite-test-accounts-card";
import { useOverviewEdit } from "./overview-edit-state";
import { SuiteCustomSectionCards, SuiteCustomSectionsEditor, toIconName, type sectionDraft } from "./suite-custom-sections";
import type { testingsuiteLifeCycle } from "@/components/suite-status-badge";

type sectionProps = {
	testSuite: { id: string; slug: string; name: string; description: string; status: testingsuiteLifeCycle };
	suiteId: string;
	description: string;
	accounts: suiteTestAccount[];
	sections: suiteOverviewSection[];
};

// The Overview's editable sections. View mode shows only the sections that
// have content; edit mode (the header's pencil) shows every section's editor
// with one Save/Cancel.
export function SuiteOverviewContent({ canEdit, ...props }: sectionProps & { canEdit: boolean }) {
	const { isEdit } = useOverviewEdit();
	if (isEdit && canEdit) return <OverviewEditor {...props} />;
	return (
		<div className="flex flex-col gap-6">
			<SuiteDescriptionCard description={props.description} />
			<SuiteTestAccountsCard accounts={props.accounts} />
			<SuiteCustomSectionCards sections={props.sections} />
		</div>
	);
}

// Mounted only while editing, so the drafts start from the saved content each time.
function OverviewEditor({ testSuite, suiteId, description, accounts, sections }: sectionProps) {
	const { setIsEdit } = useOverviewEdit();
	const [descriptionDraft, setDescriptionDraft] = useState(description);
	const [rows, setRows] = useState<accountRow[]>(() =>
		accounts.map((a) => ({ key: a.id, role: a.role, username: a.username, password: a.password })),
	);
	const [sectionDrafts, setSectionDrafts] = useState<sectionDraft[]>(() =>
		sections.map((s) => ({ key: s.id, title: s.title, icon: s.icon ?? "", content: s.content })),
	);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const autoSave = testSuite.status === "draft";
	// Autosave runs while typing, so it must not disable (and blur) the fields.
	const locked = isPending && !autoSave;

	// The parts that changed and are valid (blank account rows and empty sections
	// are dropped); invalid parts are left out and reported in `invalid`.
	function changes() {
		const invalid: string[] = [];
		const filled = rows.filter((r) => r.role || r.username.trim() || r.password);
		const accountsValid = !filled.some((r) => !r.username.trim() || !r.password);
		if (!accountsValid) invalid.push("Every account needs a username/email and a password.");
		const nextSections = sectionDrafts
			.filter((s) => s.title.trim() || s.icon.trim() || s.content.trim())
			.map((s) => ({ title: s.title.trim(), icon: toIconName(s.icon), content: s.content.trim() }));
		const sectionsValid = !nextSections.some((s) => !s.title);
		if (!sectionsValid) invalid.push("Every custom section needs a header.");
		const nextAccounts = filled.map(({ role, username, password }) => ({ role, username: username.trim(), password }));
		const savedAccounts = accounts.map(({ role, username, password }) => ({ role, username, password }));
		const savedSections = sections.map(({ title, icon, content }) => ({ title, icon, content }));
		const payload = {
			suiteId,
			description: descriptionDraft.trim() !== description.trim() ? descriptionDraft : undefined,
			accounts: accountsValid && JSON.stringify(nextAccounts) !== JSON.stringify(savedAccounts) ? nextAccounts : undefined,
			sections: sectionsValid && JSON.stringify(nextSections) !== JSON.stringify(savedSections) ? nextSections : undefined,
		};
		const hasChanges = payload.description !== undefined || payload.accounts !== undefined || payload.sections !== undefined;
		return { payload, hasChanges, invalid };
	}

	const current = changes();
	const latest = useRef(current);
	useEffect(() => {
		latest.current = current;
	});

	// Draft: save 1s after the last edit. On unmount (e.g. the suite just moved to
	// Ready) any edit still waiting on the timer is saved straight away.
	useEffect(() => {
		if (!autoSave || isPending || !current.hasChanges) return;
		const timer = setTimeout(() => {
			startTransition(async () => {
				const result = await saveSuiteOverview(latest.current.payload);
				setError(result.ok ? null : result.error);
			});
		}, 1000);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoSave, isPending, descriptionDraft, rows, sectionDrafts, description, accounts, sections]);
	useEffect(() => () => {
		if (autoSave && latest.current.hasChanges) void saveSuiteOverview(latest.current.payload);
	}, [autoSave]);

	// Ready onward: one manual save, blocked while any part is invalid.
	function save() {
		const { payload, hasChanges, invalid } = changes();
		if (invalid.length > 0) {
			setError(invalid[0]);
			return;
		}
		if (!hasChanges) {
			setIsEdit(false);
			return;
		}
		startTransition(async () => {
			const result = await saveSuiteOverview(payload);
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setIsEdit(false);
		});
	}

	return (
		<div className="flex flex-col gap-6">
			{
				testSuite.status !== "draft" ?
				<div className="flex flex-row items-center justify-between gap-4">
					<div className="">
						<div className="flex flex-row gap-2 items-center">
						<Pencil className="size-4" />
						<p className="font-semibold text-lg">Configure Overview Content</p>
					</div>
					<p className="text-xs text-muted-foreground">Edit the description and test accounts for this testing suite and different section this the testing</p>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex flex-row gap-2 justify-end">
							<Button className="text-xs" type="button" variant="outline" onClick={() => setIsEdit(false)} disabled={isPending}>Cancel</Button>
							<Button className="text-xs" type="button" onClick={save} disabled={isPending}>
								<Save className="size-4" />
								{isPending ? "Saving…" : "Save Changes"}
							</Button>
						</div>
						{error && <p className="text-xs text-destructive text-right">{error}</p>}
					</div>
				</div> : null
				// <p className={`text-xs text-right ${error ? "text-destructive" : "text-muted-foreground"}`}>
				// 	{error ?? (isPending ? "Saving…" : current.hasChanges ? "Unsaved changes…" : current.invalid[0] ? `Not saved: ${current.invalid[0]}` : "All changes saved")}
				// </p>
			}
			<SuiteDescriptionEditor draft={descriptionDraft} onDraftChange={setDescriptionDraft} disabled={locked} />
			<SuiteTestAccountsEditor rows={rows} onRowsChange={setRows} disabled={locked} />
			<SuiteCustomSectionsEditor sections={sectionDrafts} onSectionsChange={setSectionDrafts} disabled={locked} />

		</div>
	);
}
