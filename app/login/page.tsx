import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ redirectTo?: string }>;
}) {
	const { redirectTo } = await searchParams;

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (user) {
		redirect(safeRedirect(redirectTo));
	}

	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-4xl">
				<LoginForm redirectTo={redirectTo} />
			</div>
		</div>
	);
}
