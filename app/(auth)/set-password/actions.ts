"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error?: string } | null;

// An invited user arrives here signed in (via /auth/confirm) but without a password yet.
export async function setPassword(_prevState: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 8) return { error: "Use at least 8 characters." };
    if (password !== confirm) return { error: "The passwords don't match." };

    const supabase = await createClient();
    // Invite links arrive unverified: sign in only now that the password is valid.
    const tokenHash = String(formData.get("token_hash") ?? "");
    if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
        if (verifyError) return { error: "That link is invalid or has expired. Ask an admin to send a new invite." };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };

    redirect("/dashboard");
}
