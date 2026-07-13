"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KeySignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/key-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      setError("Invalid key.");
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <div className="partno mb-4">AUTH / SIGN IN</div>
      <h1 className="font-display m-0 text-[1.7rem] leading-[1.05]">Welcome back.</h1>
      <p className="mt-3 font-sans text-[0.88rem] leading-relaxed text-[var(--text-dim)]">
        Enter your access key.
      </p>

      {error && (
        <p className="m-0 mt-6 font-mono text-[0.72rem] leading-relaxed" style={{ color: "var(--down)" }}>
          ERR: {error}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Access key"
          autoFocus
          className="mt-8 w-full border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm outline-none"
        />
        <button
          type="submit"
          disabled={pending || !key}
          className="btn btn-primary mt-3 flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
