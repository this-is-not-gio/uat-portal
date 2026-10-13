"use client"

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TONES = {
	amber: "border-amber-500/40 bg-amber-50/60 text-amber-600 [&_[data-slot=button]]:hover:bg-amber-600/10 [&_[data-slot=button]]:hover:text-amber-700",
	destructive: "border-destructive/40 bg-destructive/5 text-destructive [&_[data-slot=button]]:hover:bg-destructive/10 [&_[data-slot=button]]:hover:text-destructive",
}

// A notice the user can close. Closing only hides it until the page is reloaded.
// The tone colors the border, background, text and close button; children inherit the text color.
export default function DismissibleNotice({ tone = "amber", className, children }: { tone?: keyof typeof TONES; className?: string; children: ReactNode }) {
	const [open, setOpen] = useState(true)
	if (!open) return null

	return (
		<div role="status" className={cn("flex flex-row items-center justify-between gap-2 rounded-md border p-4", TONES[tone], className)}>
			{children}
			<Button variant="ghost" size="icon" className="shrink-0 text-current" aria-label="Dismiss notice" onClick={() => setOpen(false)}>
				<X />
			</Button>
		</div>
	)
}
