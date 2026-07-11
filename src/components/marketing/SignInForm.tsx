"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "w-full border border-[var(--border-strong)] bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[16px] text-[var(--text)] outline-none transition-colors duration-150 focus:border-[var(--text-dim)] sm:text-[0.85rem]";

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <div className="partno mb-4">AUTH / SIGN IN</div>
      <h1 className="font-display m-0 text-[1.7rem] leading-[1.05]">Welcome back.</h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="partno">&gt; EMAIL</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="partno">&gt; PASSWORD</span>
            <Link href="/forgot-password" className="font-mono text-[0.68rem] text-[var(--text-faint)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text-dim)]">
              Forgot password?
            </Link>
          </div>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>

        {error && (
          <p className="m-0 font-mono text-[0.72rem] leading-relaxed" style={{ color: "var(--down)" }}>
            ERR: {error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-50">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 font-sans text-[0.85rem] text-[var(--text-dim)]">
        No account yet?{" "}
        <Link href="/signup" className="font-semibold text-[var(--text)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors duration-150 hover:decoration-[var(--text-dim)]">
          Start your free trial
        </Link>
      </p>
    </div>
  );
}
