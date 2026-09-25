import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { z } from "zod";
import { errorMessage, useLogin, useRegister } from "../api/hooks";
import { Brand } from "../components/Brand";
import { Button, Field } from "../components/ui";

const email = z.string().trim().min(1, "Email belum diisi.").email("Format email belum benar. Contoh: nama@contoh.com");
const registerSchema = z.object({
  email,
  password: z.string().min(8, "Password minimal 8 karakter.").max(128, "Password maksimal 128 karakter."),
});
const loginSchema = z.object({ email, password: z.string().min(1, "Password belum diisi.") });

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: "Masuk dengan Google dibatalkan.",
  google_state: "Sesi masuk Google kedaluwarsa. Coba lagi.",
  google_failed: "Masuk dengan Google belum berhasil. Coba lagi.",
  google_not_configured: "Masuk dengan Google belum tersedia. Gunakan email dan password.",
  google_email_unverified: "Email akun Google belum terverifikasi.",
};

/** Layar masuk dan daftar (PRD bagian 11, layar 1). */
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const [, navigate] = useLocation();
  const search = new URLSearchParams(useSearch());
  const login = useLogin();
  const register = useRegister();
  const [emailValue, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(GOOGLE_ERRORS[search.get("error") ?? ""] ?? null);
  const pending = login.isPending || register.isPending;
  const isLogin = mode === "login";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = (isLogin ? loginSchema : registerSchema).safeParse({ email: emailValue, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    try {
      if (isLogin) await login.mutateAsync({ email: emailValue.trim(), password });
      else await register.mutateAsync({ email: emailValue.trim(), password, display_name: name.trim() || undefined });
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 py-10 sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-start gap-3">
          <Brand className="text-headline" />
          <p className="text-body text-ink-muted">Kelola dana, sederhana.</p>
        </div>
        <div className="rounded-lg border border-outline bg-surface p-6">
          <h1 className="mb-6 text-headline text-ink">{isLogin ? "Masuk" : "Buat akun"}</h1>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            {!isLogin && (
              <Field label="Nama panggilan (opsional)" autoComplete="nickname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            )}
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={emailValue}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Field
              label="Password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint={isLogin ? undefined : "Minimal 8 karakter."}
            />
            {formError && (
              <p role="alert" className="rounded-md bg-expense-container px-4 py-3 text-body-small text-expense">
                {formError}
              </p>
            )}
            <Button type="submit" block loading={pending}>
              {isLogin ? "Masuk" : "Daftar"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-body-small text-ink-muted">
            <span className="h-px flex-1 bg-outline" /> atau <span className="h-px flex-1 bg-outline" />
          </div>
          <a
            href="/api/v1/auth/google"
            className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-outline bg-surface text-label text-ink transition hover:bg-surface-variant"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5">
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.1a11 11 0 0 0 0 10l3.7-2.8z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
            </svg>
            Lanjutkan dengan Google
          </a>
        </div>
        <p className="mt-6 text-center text-body text-ink-muted">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <Link href={isLogin ? "/daftar" : "/masuk"} className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline">
            {isLogin ? "Daftar" : "Masuk"}
          </Link>
        </p>
      </div>
    </main>
  );
}
