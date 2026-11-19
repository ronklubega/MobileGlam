import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back" subtitle="Sign in to manage your business."
      footer={<>New business? <a href="/register" className="font-semibold text-brand">Create an account</a></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
