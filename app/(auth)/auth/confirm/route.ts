import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/supabase/auth";

// Landing for links in Supabase auth emails (invites). The email template must link to
// /auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password
// Verifying the token signs the user in (sets the session cookies), then we send them on.
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = safeRedirect(searchParams.get("next"));

    if (tokenHash && type) {
        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (!error) return NextResponse.redirect(new URL(next, request.url));
        console.error("Auth confirm failed:", error.message);
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "That link is invalid or has expired. Ask an admin to send a new invite.");
    return NextResponse.redirect(loginUrl);
}
