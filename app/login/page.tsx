import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
		redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/epics");
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-8">
			<LoginForm redirectTo={redirectTo} />
		</div>
	);
}
