"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { Collapsible } from "@/components/ui/collapsible";

// Sidebar tree open/closed state, kept outside React. Every sidebar click is a
// route change that remounts the [[...section]] page (and this tree with it),
// so plain `defaultOpen` would snap each folder back on every navigation.
// Module scope survives that remount; a full reload or leaving the Test Cases
// tab (see PageTab) starts fresh. Only ever written from event handlers, so
// the server's copy stays empty and hydration always matches `defaultOpen`.
const openState = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function setTreeOpen(id: string, open: boolean) {
	openState.set(id, open);
	listeners.forEach((listener) => listener());
}

export function clearTreeState() {
	if (openState.size === 0) return;
	openState.clear();
	listeners.forEach((listener) => listener());
}

// `id` must be unique across the whole tab (prefix it with the suite slug and
// node kind). Clicking the header's own row button also opens the folder; the
// chevron still toggles, and row actions (menu-action) are left alone.
export default function TreeCollapsible({ id, defaultOpen = false, className, children }: {
	id: string;
	defaultOpen?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	const open = useSyncExternalStore(
		subscribe,
		() => openState.get(id) ?? defaultOpen,
		() => defaultOpen,
	);

	function handleClick(event: React.MouseEvent<HTMLDivElement>) {
		if (open) return;
		const target = event.target as HTMLElement;
		if (!target.closest('[data-sidebar="menu-button"]')) return;
		// Only this folder's header — not a row inside its panel, and not a
		// nested folder (whose own TreeCollapsible handles it).
		if (target.closest('[data-slot="collapsible"]') !== event.currentTarget) return;
		const panel = target.closest('[data-slot="collapsible-content"]');
		if (panel && event.currentTarget.contains(panel)) return;
		setTreeOpen(id, true);
	}

	return (
		<Collapsible className={className} open={open} onOpenChange={(next) => setTreeOpen(id, next)} onClick={handleClick}>
			{children}
		</Collapsible>
	);
}
