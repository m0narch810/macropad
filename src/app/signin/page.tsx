import { Suspense } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import KeySignInForm from "@/components/marketing/KeySignInForm";

export const metadata = {
  title: "Sign in · YYY Terminal",
};

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <KeySignInForm />
      </Suspense>
    </AuthShell>
  );
}
