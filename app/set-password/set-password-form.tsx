"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm() {
	const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(setPassword, null);

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Set your password</CardTitle>
				<CardDescription>You&apos;ll use it to sign in to the UAT Portal from now on.</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="flex flex-col gap-4">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="password">New password</FieldLabel>
							<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
							<Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
						</Field>
					</FieldGroup>
					{state?.error && <p className="text-sm text-destructive">{state.error}</p>}
					<Button type="submit" disabled={pending}>
						{pending ? "Saving..." : "Save password"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
