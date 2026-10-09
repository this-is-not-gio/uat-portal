"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm() {
	const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(setPassword, null);

	return (
		<form action={formAction} className="w-full">
			<FieldGroup>
				<Field className="flex flex-col gap-1">
					<FieldLabel htmlFor="password" className="text-xs text-muted-foreground">New password</FieldLabel>
					<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="font-mono px-3 py-5 bg-white" placeholder="*********" />
				</Field>
				<Field className="flex flex-col gap-1">
					<FieldLabel htmlFor="confirm" className="text-xs text-muted-foreground">Confirm password</FieldLabel>
					<Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="font-mono px-3 py-5 bg-white" placeholder="*********" />
				</Field>
				{state?.error && <p className="text-sm text-destructive">{state.error}</p>}
				<Field>
					<Button type="submit" disabled={pending} className="p-6 font-medium">
						<p className="text-sm font-semibold!">{pending ? "Saving..." : "Save password"}</p>
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}
