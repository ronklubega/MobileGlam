import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="List your business" subtitle="Create your account, then set up your salon, barbershop or clinic."
      footer={<>Already registered? <a href="/login" className="font-semibold text-brand">Sign in</a></>}
    >
      <RegisterForm />
    </AuthShell>
  );
}
