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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import image from "@/app/LoginImage.jpg";
import { ClipboardList } from "lucide-react";

export function LoginForm({ redirectTo, className, ...props }: { redirectTo?: string; className?: string; props?: React.HTMLAttributes<HTMLDivElement> }) {
	const [state, formAction, pending] = useActionState<SignInState, FormData>(
		signIn,
		null
	);

	return (
		<form action={formAction} className="w-full">
			<FieldGroup>
				<Field className="flex flex-col gap-1">
					<FieldLabel htmlFor="email" className="text-xs text-muted-foreground">Email or Account Name</FieldLabel>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						placeholder="m@example.com"
						required
						className="px-3 py-5 bg-white font-mono"
					/>
				</Field>
				<Field className="flex flex-col gap-1">
					<div className="flex items-center">
						<FieldLabel htmlFor="password" className="text-xs text-muted-foreground">Password</FieldLabel>
					</div>
					<Input id="password" name="password" type="password" autoComplete="current-password" required className="font-mono px-3 py-5 bg-white" placeholder="*********" />
				</Field>
				{state?.error && (
					<p className="text-sm text-destructive">{state.error}</p>
				)}
				<Field>
					<Button type="submit" disabled={pending} className="p-6 font-medium">
						
						{
							pending ? <p className="text-sm font-semibold!">Logging in...</p> : <p className="text-sm font-semibold!">Login</p>
						}
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}
