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
		// <Card className="w-full max-w-sm">
		// 	<CardHeader>
		// 		<CardTitle>Sign in</CardTitle>
		// 		<CardDescription>Sign in to access the UAT Portal.</CardDescription>
		// 	</CardHeader>
		// 	<CardContent>
		// 		<form action={formAction} className="flex flex-col gap-4">
		// 			<input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
		// 			<div className="flex flex-col gap-2">
		// 				<Label htmlFor="email">Email</Label>
		// 				<Input id="email" name="email" type="email" autoComplete="email" required />
		// 			</div>
		// 			<div className="flex flex-col gap-2">
		// 				<Label htmlFor="password">Password</Label>
		// 				<Input
		// 					id="password"
		// 					name="password"
		// 					type="password"
		// 					autoComplete="current-password"
		// 					required
		// 				/>
		// 			</div>
		// 			{state?.error && (
		// 				<p className="text-sm text-destructive">{state.error}</p>
		// 			)}
		// 			<Button type="submit" disabled={pending} className="mt-2">
		// 				{pending ? "Signing in..." : "Sign in"}
		// 			</Button>
		// 		</form>
		// 	</CardContent>
		//</Card>
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card className="overflow-hidden p-0">
				<CardContent className="grid p-0 md:grid-cols-2">
					<form action={formAction} className="p-6 md:p-8 h-120 flex flex-col justify-center gap-10">
						<div className="flex flex-col items-center gap-4 text-center">
							<div className="bg-blue-400/20 p-4 rounded-md">
								<ClipboardList className="h-10 w-10 text-blue-800" />
							</div>
							<div className="">
								<h1 className="text-2xl font-bold">Start Testing</h1>
								<p className="text-balance text-muted-foreground text-xs">
									Sign in to the UAT Portal to run and review your test suites
								</p>
							</div>
						</div>
						<FieldGroup>
							<Field className="flex flex-col gap-1">
								<FieldLabel htmlFor="email" className="text-xs">Email or Account Name</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									placeholder="m@example.com"
									required 
									className="px-3 py-5"
								/>
							</Field>
							<Field className="flex flex-col gap-1">
								<div className="flex items-center">
									<FieldLabel htmlFor="password" className="text-xs">Password</FieldLabel>
								</div>
								<Input id="password" name="password" type="password" autoComplete="current-password" required className="px-3 py-5" />
							</Field>
							{state?.error && (
								<p className="text-sm text-destructive">{state.error}</p>
							)}
							<Field>
								<Button type="submit" disabled={pending} className="p-6 font-medium">
									{
										pending ? <p className="text-sm font-medium">Logging in...</p> : <p className="text-sm font-medium">Login</p>
									}
								</Button>
							</Field>
						</FieldGroup>
					</form>
					<div className="relative hidden bg-muted md:block">
						<img
							src={image.src}
							alt="Image"
							className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
