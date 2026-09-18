"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
	const [state, formAction, pending] = useActionState<SignInState, FormData>(
		signIn,
		null
	);

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>Sign in to access the UAT Portal.</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="flex flex-col gap-4">
					<input type="hidden" name="redirectTo" value={redirectTo ?? "/epics"} />
					<div className="flex flex-col gap-2">
						<Label htmlFor="email">Email</Label>
						<Input id="email" name="email" type="email" autoComplete="email" required />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
						/>
					</div>
					{state?.error && (
						<p className="text-sm text-destructive">{state.error}</p>
					)}
					<Button type="submit" disabled={pending} className="mt-2">
						{pending ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
