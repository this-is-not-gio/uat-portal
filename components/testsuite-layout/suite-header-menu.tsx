"use client";

import { useState } from "react";
import { BookOpen, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SuiteDialog from "@/components/suite-dialog";

// The "more" menu on the suite header (TestSuiteLayout). The dialog sits outside
// the menu so it stays open after the menu closes.
export default function SuiteHeaderMenu({ suite, canEdit }: {
	suite: { id: string; name: string; code: string | null; slug: string; description: string; status: string };
	canEdit: boolean;
}) {
	const [editOpen, setEditOpen] = useState(false);

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
				<DropdownMenuItem className="text-xs">
					<BookOpen size={14} />
					<span>Link Manual</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
		{canEdit && <SuiteDialog suite={suite} open={editOpen} onOpenChange={setEditOpen} />}
		</>
	);
}
