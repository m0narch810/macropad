"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "w-full border border-[var(--border-strong)] bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[16px] text-[var(--text)] outline-none transition-colors duration-150 focus:border-[var(--text-dim)] sm:text-[0.85rem]";

export default function ResetPasswordForm() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(data.session !== null);
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1200);
  }

  return (
    <div>
      <div className="partno mb-4">AUTH / RESET PASSWORD</div>
      <h1 className="font-display m-0 text-[1.7rem] leading-[1.05]">Set a new password.</h1>

      {!ready ? null : !hasSession ? (
        <div className="mt-8 border border-[var(--border-strong)] bg-[var(--panel-2)] p-5">
          <div className="partno mb-2" style={{ color: "var(--down)" }}>
            EXPIRED
          </div>
          <p className="m-0 font-sans text-[0.88rem] leading-relaxed text-[var(--text)]">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="font-semibold underline decoration-[var(--border-strong)] underline-offset-4">
              Request a new one
            </Link>
            .
          </p>
        </div>
      ) : done ? (
        <div className="mt-8 border border-[var(--border-strong)] bg-[var(--panel-2)] p-5">
          <div className="partno mb-2" style={{ color: "var(--up)" }}>
            DONE
          </div>
          <p className="m-0 font-sans text-[0.88rem] leading-relaxed text-[var(--text)]">Password updated - taking you to the desk…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="partno">&gt; NEW PASSWORD</span>
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

          <label className="flex flex-col gap-1.5">
            <span className="partno">&gt; CONFIRM PASSWORD</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <p className="m-0 font-mono text-[0.72rem] leading-relaxed" style={{ color: "var(--down)" }}>
              ERR: {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-50">
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
