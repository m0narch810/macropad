import AuthShell from "@/components/marketing/AuthShell";
import ResetPasswordForm from "@/components/marketing/ResetPasswordForm";

export const metadata = {
  title: "Reset password · Trifekta",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
