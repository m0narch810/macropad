"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "w-full border border-[var(--border-strong)] bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[16px] text-[var(--text)] outline-none transition-colors duration-150 focus:border-[var(--text-dim)] sm:text-[0.85rem]";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <div className="partno mb-4">AUTH / RESET PASSWORD</div>
      <h1 className="font-display m-0 text-[1.7rem] leading-[1.05]">Forgot your password?</h1>
      <p className="mt-3 font-sans text-[0.88rem] leading-relaxed text-[var(--text-dim)]">
        Enter the email on your account and we&apos;ll send you a link to set a new one.
      </p>

      {sent ? (
        <div className="mt-8 border border-[var(--border-strong)] bg-[var(--panel-2)] p-5">
          <div className="partno mb-2" style={{ color: "var(--up)" }}>
            SENT
          </div>
          <p className="m-0 font-sans text-[0.88rem] leading-relaxed text-[var(--text)]">
            Check <span className="font-semibold">{email}</span> for a link to reset your password.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="partno">&gt; EMAIL</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>

          {error && (
            <p className="m-0 font-mono text-[0.72rem] leading-relaxed" style={{ color: "var(--down)" }}>
              ERR: {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-50">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 font-sans text-[0.85rem] text-[var(--text-dim)]">
        <Link href="/signin" className="font-semibold text-[var(--text)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors duration-150 hover:decoration-[var(--text-dim)]">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
