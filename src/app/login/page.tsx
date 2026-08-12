"use client";

import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Lock, Mail, Stethoscope } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * Only ever follow a same-site path (starts with exactly one "/"), never a
 * scheme-relative URL like "//evil.com" — this value comes straight from the
 * query string, so it must not be trusted as a redirect target otherwise.
 */
function safeRedirect(target: string | null): string | null {
  if (!target) return null;
  return /^\/(?!\/)/.test(target) ? target : null;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      return "Invalid credentials. Please contact your administrator if the issue persists.";
    }
    if (error.code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (error.code === "auth/network-request-failed") {
      return "No internet connection. Please check your connection and try again.";
    }
  }
  return "Could not log in. Please try again.";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

// useSearchParams() (for the post-login redirect target) requires a Suspense
// boundary above it in the App Router, hence the wrapper component above.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect")) ?? "/";
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [loading, user, redirectTo, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isFirebaseConfigured) return;
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace(redirectTo);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface p-md">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#00685f 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="fixed top-xl left-xl flex items-center gap-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-headline-md text-label-md leading-tight font-bold text-on-surface">AHMC</span>
          <span className="text-[10px] font-medium tracking-widest text-outline uppercase">Nankana Sahib</span>
        </div>
      </div>

      <main className="z-10 w-full max-w-[480px]">
        <div className="relative space-y-lg overflow-hidden rounded-xl border border-outline-variant/30 bg-white/95 p-lg shadow-[0_4px_12px_rgba(15,23,42,0.05)] backdrop-blur-sm md:p-xl">
          <header className="space-y-sm text-center">
            <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">
              Dr. Abdul Hayee Medical Centre
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Staff Login</p>
          </header>

          {!isFirebaseConfigured && (
            <div className="flex items-start gap-md rounded-lg border border-amber-300 bg-amber-50 p-md text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="font-label-md text-label-md">
                Firebase is not configured yet. Add your project&apos;s config to{" "}
                <code className="rounded bg-amber-100 px-1">.env.local</code> and restart the server —
                see the README for the exact steps.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-md rounded-lg border border-error/20 bg-error-container/50 p-md text-on-error-container">
              <p className="font-label-md text-label-md">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="space-y-xs">
              <label className="ml-xs block font-label-md text-label-md text-on-surface-variant" htmlFor="email">
                Clinic Email
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-md text-outline transition-colors group-focus-within:text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff.name@ahmc.com"
                  className="h-[56px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest pr-md pl-12 font-body-md text-on-surface outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
              </div>
            </div>

            <div className="space-y-xs">
              <div className="flex items-center justify-between px-xs">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-md text-outline transition-colors group-focus-within:text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-[56px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest pr-md pl-12 font-body-md text-on-surface outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-md text-outline transition-colors hover:text-on-surface"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-sm px-xs pt-xs">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary-container"
              />
              <label htmlFor="remember" className="font-label-md text-label-md text-on-surface-variant select-none">
                Remember this station for 24 hours
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !isFirebaseConfigured}
              className="mt-lg flex h-[56px] w-full items-center justify-center gap-md rounded-xl bg-primary font-label-md text-body-lg text-on-primary shadow-lg shadow-primary/10 transition-all hover:bg-primary-container active:scale-[0.98] disabled:opacity-70"
            >
              <span>{submitting ? "Logging in…" : "Log in"}</span>
              {!submitting && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <footer className="border-t border-outline-variant/30 pt-md text-center">
            <p className="font-label-md text-label-md text-outline">
              Secure terminal for authorized staff only.
              <br />
              Nankana Sahib, PK
            </p>
          </footer>

          <div className="absolute right-0 bottom-0 left-0 h-1 bg-primary-fixed" />
        </div>

        <div className="mt-lg flex justify-center gap-lg">
          <button className="border-b-2 border-primary font-label-md text-label-md font-bold text-primary">
            English
          </button>
          <button className="font-urdu text-label-md text-on-surface-variant transition-colors hover:text-primary">
            اردو
          </button>
        </div>
      </main>
    </div>
  );
}
