"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

export const PLAN_SECTIONS = [
	{ id: "hero", label: "Overview" },
	{ id: "what-is-uat", label: "What is User Acceptance Testing" },
	{ id: "how-it-runs", label: "How it runs" },
	{ id: "scope", label: "Scope" },
	{ id: "weekly-cycle", label: "Weekly cycle" },
	{ id: "support-desk", label: "Support desk" },
	{ id: "targets", label: "Targets" },
];

// Floating section navigation. Hidden while the hero is in view.
export function PlanNav() {
	const [active, setActive] = useState(PLAN_SECTIONS[0].id);
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((e) => e.isIntersecting);
				if (visible.length === 0) return;
				visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				setActive(visible[0].target.id);
			},
			{ threshold: [0.5, 0.75] },
		);
		PLAN_SECTIONS.forEach(({ id }) => {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		});
		return () => observer.disconnect();
	}, []);

	return (
		<nav
			aria-label="Master plan sections"
			aria-hidden={active === "hero"}
			className={`fixed right-6 top-1/2 z-20 -translate-y-1/2 transition-opacity duration-300 ${active === "hero" ? "pointer-events-none opacity-0" : "opacity-100"}`}
		>
			<ul className="flex flex-col gap-1">
				{PLAN_SECTIONS.map(({ id, label }) => {
					if (id === "hero") return null;
					const isActive = active === id;
					return (
						<li key={id} className="relative flex justify-end">
							{/* Active label floats beside the dot so the dot never moves. */}
							<span
								aria-hidden
								className={`pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium text-foreground transition-all duration-300 ease-out ${isActive ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"}`}
							>
								{label}
							</span>
							<Tooltip disabled={isActive}>
								<TooltipTrigger
									render={
										<a
											href={`#${id}`}
											aria-label={label}
											aria-current={isActive ? "true" : undefined}
											onClick={(e) => {
												e.preventDefault();
												document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
											}}
											className="group flex size-6 items-center justify-center rounded-full"
										/>
									}
								>
									<span
										className={`block rounded-full border border-foreground transition-all duration-300 ease-out group-hover:bg-foreground/40 ${isActive ? "size-3 bg-foreground" : "size-2.5 bg-transparent"}`}
									/>
								</TooltipTrigger>
								<TooltipContent side="left" sideOffset={8}>
									{label}
								</TooltipContent>
							</Tooltip>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
