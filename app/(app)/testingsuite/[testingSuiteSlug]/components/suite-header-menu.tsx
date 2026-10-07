"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteSuite } from "@/lib/supabase/authoring-actions";
import SuiteDialog from "@/components/suite-dialog";
import ConfirmDialog from "../../../../../components/confirm-dialog";
import type { ExitCriteria } from "@/lib/supabase/sign-off-report";

type suiteFields = { id: string; name: string; code: string | null; slug: string; description: string; status: string };

// The "more" menu on the suite page header. Edit is hidden once the suite is
// locked (same rule as upsert_suite); delete only exists while it's a Draft
// (delete_suite enforces that too). The dialogs sit outside the menu so they
// stay open after the menu closes.
export default function SuiteHeaderMenu({ suite, exitCriteria }: { suite: suiteFields; exitCriteria: ExitCriteria }) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const canEdit = !["sign_off_issued", "signed_off", "archived"].includes(suite.status);
	const canDelete = suite.status === "draft";

	if (!canEdit && !canDelete) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="icon" variant="outline" aria-label="Suite actions">
					<MoreVertical />
				</Button>} />
				<DropdownMenuContent align="end" className="w-56">
					{canEdit && (
						<DropdownMenuItem className="text-xs" onClick={() => setEditOpen(true)}>
							<Pencil size={14} />
							<span>Edit Testing Suite</span>
						</DropdownMenuItem>
					)}
					{canDelete && (
						<DropdownMenuItem variant="destructive" className="text-xs" onClick={() => setDeleteOpen(true)}>
							<Trash2 size={14} />
							<span>Delete Testing Suite</span>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{canEdit && <SuiteDialog suite={suite} exitCriteria={exitCriteria} open={editOpen} onOpenChange={setEditOpen} />}
			{canDelete && (
				<ConfirmDialog
					open={deleteOpen}
					onOpenChange={setDeleteOpen}
					title={`Delete ${suite.name}?`}
					description="This draft suite and everything in it are deleted. This can't be undone."
					confirmLabel="Delete suite"
					onConfirm={() => deleteSuite({ suiteId: suite.id })}
					onDone={() => router.push("/dashboard")}
				/>
			)}
		</>
	);
}
