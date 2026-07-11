"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "w-full border border-[var(--border-strong)] bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[0.85rem] text-[var(--text)] outline-none transition-colors duration-150 focus:border-[var(--text-dim)]";

export default function SignUpForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }

    // If the Supabase project requires email confirmation, signUp succeeds
    // but returns no session yet - tell the user to check their inbox
    // instead of silently doing nothing.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div>
      <div className="partno mb-4">AUTH / FREE TRIAL</div>
      <h1 className="font-display m-0 text-[1.7rem] leading-[1.05]">Launch the desk.</h1>
      <p className="mt-3 font-sans text-[0.88rem] leading-relaxed text-[var(--text-dim)]">
        Every feature, no card required. Pro pricing comes later, and you get 14 days notice first.
      </p>

      {checkEmail ? (
        <div className="mt-8 border border-[var(--border-strong)] bg-[var(--panel-2)] p-5">
          <div className="partno mb-2" style={{ color: "var(--up)" }}>
            SENT
          </div>
          <p className="m-0 font-sans text-[0.88rem] leading-relaxed text-[var(--text)]">
            Check <span className="font-semibold">{email}</span> for a confirmation link to finish setting up
            your account.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="partno">&gt; EMAIL</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="partno">&gt; PASSWORD</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <span className="font-mono text-[0.66rem] text-[var(--text-faint)]">min 6 characters</span>
          </label>

          {error && (
            <p className="m-0 font-mono text-[0.72rem] leading-relaxed" style={{ color: "var(--down)" }}>
              ERR: {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-50">
            {pending ? "Creating account…" : "Start free trial"}
          </button>
        </form>
      )}

      <p className="mt-6 font-sans text-[0.85rem] text-[var(--text-dim)]">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-[var(--text)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors duration-150 hover:decoration-[var(--text-dim)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
