import { Suspense } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import DiscordSignInForm from "@/components/marketing/DiscordSignInForm";

export const metadata = {
  title: "Sign in · Trifekta",
};

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <DiscordSignInForm />
      </Suspense>
    </AuthShell>
  );
}
