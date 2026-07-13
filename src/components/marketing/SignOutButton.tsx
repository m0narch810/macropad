"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await fetch("/api/key-auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} disabled={pending} className={className}>
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
