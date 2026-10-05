"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The Overview's single edit state. OverviewTab stays a Server Component; the
// header button and the editable sections share isEdit through this context.
const OverviewEditContext = createContext<{ isEdit: boolean; setIsEdit: (value: boolean) => void } | null>(null);

// alwaysEdit (Draft suites): the Overview is always in edit mode and autosaves;
// from Ready onward it opens in view mode behind the pencil button.
export function OverviewEditProvider({ alwaysEdit = false, children }: { alwaysEdit?: boolean; children: ReactNode }) {
	const [editing, setIsEdit] = useState(false);
	const isEdit = alwaysEdit || editing;
	return <OverviewEditContext.Provider value={{ isEdit, setIsEdit }}>{children}</OverviewEditContext.Provider>;
}

export function useOverviewEdit() {
	const context = useContext(OverviewEditContext);
	if (!context) throw new Error("useOverviewEdit must be used inside OverviewEditProvider");
	return context;
}

// Hidden while editing; the editor's own Save/Cancel end edit mode.
export function EditOverviewButton() {
	const { isEdit, setIsEdit } = useOverviewEdit();
	if (isEdit) return null;
	return (
		<Tooltip>
			<TooltipTrigger render={
				<Button size="icon" variant="outline" aria-label="Edit Overview Content" onClick={() => setIsEdit(true)}>
					<Pencil className="size-4" />
				</Button>
			} />
			<TooltipContent side="bottom">
				Edit Overview Content
			</TooltipContent>
		</Tooltip>
	);
}
