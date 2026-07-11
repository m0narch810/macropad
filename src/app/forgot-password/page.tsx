import AuthShell from "@/components/marketing/AuthShell";
import ForgotPasswordForm from "@/components/marketing/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password · Trifekta",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
