"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setSuiteManualModules } from "@/lib/supabase/manual-actions";

export type linkableModule = { id: string; title: string; description: string; sectionCount: number; isPublished: boolean };

// Pick which published Testing Manual modules apply to this suite. Save applies the whole
// set at once; linked modules that were since unpublished stay listed so they can be unlinked.
export default function LinkManualDialog({ suiteId, modules, linkedIds, open, onOpenChange }: {
	suiteId: string;
	modules: linkableModule[];
	linkedIds: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [selected, setSelected] = useState(() => new Set(linkedIds));
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function toggle(id: string, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	}

	function onSave() {
		setError(null);
		startTransition(async () => {
			const result = await setSuiteManualModules({ suiteId, moduleIds: [...selected] });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			onOpenChange(false);
			router.refresh();
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Link Manual</DialogTitle>
					<DialogDescription>Choose the Testing Manual modules testers should see in this suite&apos;s Manual tab.</DialogDescription>
				</DialogHeader>
				<div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
					{modules.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No published modules yet.</p>}
					{modules.map((m) => (
						<label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50">
							<Checkbox className="mt-0.5" checked={selected.has(m.id)} onCheckedChange={(checked) => toggle(m.id, checked)} />
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="flex items-center gap-2 text-sm font-medium">
									{m.title}
									{!m.isPublished && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Unpublished</span>}
								</span>
								{m.description && <span className="text-xs text-muted-foreground">{m.description}</span>}
								<span className="text-xs text-muted-foreground">{m.sectionCount} {m.sectionCount === 1 ? "section" : "sections"}</span>
							</span>
						</label>
					))}
				</div>
				{error && <p className="text-xs text-destructive">{error}</p>}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" disabled={isPending}>Cancel</Button>} />
					<Button onClick={onSave} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
