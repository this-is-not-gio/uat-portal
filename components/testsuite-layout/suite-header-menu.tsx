"use client";

import { useState } from "react";
import { BookOpen, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SuiteDialog from "@/components/suite-dialog";
import LinkManualDialog, { type linkableModule } from "@/components/testsuite-layout/link-manual-dialog";

// The "more" menu on the suite header (TestSuiteLayout). The dialog sits outside
// the menu so it stays open after the menu closes.
export default function SuiteHeaderMenu({ suite, canEdit, manual }: {
	suite: { id: string; name: string; code: string | null; slug: string; description: string; status: string };
	canEdit: boolean;
	// Only passed for users who can author; links are locked once the suite is Signed off or Archived.
	manual?: { modules: linkableModule[]; linkedIds: string[] };
}) {
	const [editOpen, setEditOpen] = useState(false);
	const [linkOpen, setLinkOpen] = useState(false);
	const linkLocked = suite.status === "signed_off" || suite.status === "archived";

	return (
		<>
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions">
				<MoreVertical />
			</Button>} />
			<DropdownMenuContent align="end" className="w-56">
				{canEdit && (
					<DropdownMenuItem className="text-xs" onClick={() => setEditOpen(true)}>
						<Pencil size={14} />
						<span>Edit Test Suite</span>
					</DropdownMenuItem>
				)}
				{manual && (
					<DropdownMenuItem className="text-xs" disabled={linkLocked} onClick={() => setLinkOpen(true)}>
						<BookOpen size={14} />
						<span>Link Manual</span>
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
		{canEdit && <SuiteDialog suite={suite} open={editOpen} onOpenChange={setEditOpen} />}
		{manual && <LinkManualDialog key={String(linkOpen)} suiteId={suite.id} modules={manual.modules} linkedIds={manual.linkedIds} open={linkOpen} onOpenChange={setLinkOpen} />}
		</>
	);
}
