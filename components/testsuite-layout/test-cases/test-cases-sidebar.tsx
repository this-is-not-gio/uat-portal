"use client";

import { createContext, useContext, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const SidebarSheetContext = createContext<{ label: string; openSheet: () => void } | null>(null);

// The Test Cases tree: a fixed column from lg up; below that (GitHub-style) it's hidden, and
// TestCasesSidebarTrigger in the content header opens it in a sheet.
export default function TestCasesSidebar({ label, sidebar, children }: { label: string; sidebar: React.ReactNode; children: React.ReactNode }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const url = `${pathname}?${searchParams.toString()}`;
	// The sheet remembers the URL it was opened on, so picking a section (a navigation) closes it.
	const [openedAt, setOpenedAt] = useState<string | null>(null);

	return (
		<SidebarSheetContext.Provider value={{ label, openSheet: () => setOpenedAt(url) }}>
			<div className="hidden w-100 shrink-0 flex-col border-r lg:flex">{sidebar}</div>
			<Sheet open={openedAt === url} onOpenChange={(next) => setOpenedAt(next ? url : null)}>
				<SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-100">
					<SheetTitle className="px-4 pt-4 text-sm">{label}</SheetTitle>
					{sidebar}
				</SheetContent>
			</Sheet>
			{children}
		</SidebarSheetContext.Provider>
	);
}

// Opens the sidebar sheet; only shown below lg, where the sidebar column is hidden.
// withLabel: a text button for empty states that have no header to sit in.
export function TestCasesSidebarTrigger({ withLabel = false }: { withLabel?: boolean }) {
	const context = useContext(SidebarSheetContext);
	if (!context) return null;
	return withLabel ? (
		<Button variant="outline" size="sm" className="lg:hidden" onClick={context.openSheet}>
			<PanelLeft />
			{context.label}
		</Button>
	) : (
		<Button variant="ghost" size="icon-sm" className="-ml-2 lg:hidden" aria-label={`Show ${context.label.toLowerCase()}`} title={`Show ${context.label.toLowerCase()}`} onClick={context.openSheet}>
			<PanelLeft />
		</Button>
	);
}
