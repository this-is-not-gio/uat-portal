"use client";

import { useFormStatus } from "react-dom";
import { ArrowRightToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/login/actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function SignOutButton() {
	return (
		<form action={signOut}>
			<SubmitButton />
		</form>
	);
}

// useFormStatus only sees the pending state from a component rendered inside the <form>.
function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Tooltip>
			<TooltipTrigger render={
				<Button type="submit" variant="ghost" size="icon" aria-label="Sign out" disabled={pending}>
					<ArrowRightToLine className="size-4" />
				</Button>} />
			<TooltipContent side="bottom" className="w-auto">
				<p className="text-xs">Sign out</p>
			</TooltipContent>
		</Tooltip>
	);
}
