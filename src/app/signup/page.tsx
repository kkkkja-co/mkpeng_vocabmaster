"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthInit } from "@/hooks/use-auth-init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Loader2, Mail, User, Lock } from "lucide-react";
import { pageTransition } from "@/lib/animations";

export default function SignupPage() {
  useAuthInit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, uid, role, className, classNum } = useAuthStore();

  // Redirect if already logged in
  useEffect(() => {
    if (uid && role) {
      if (role === "teacher") {
        router.push("/teacher");
      } else if (className && classNum) {
        router.push("/cards");
      } else {
        router.push("/select-class");
      }
    }
  }, [uid, role, className, classNum, router]);

  const handleGoogleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-md"
        {...pageTransition}
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-warm-accent/10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <BookOpen className="size-8 text-warm-accent" />
          </motion.div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-warm-text-muted">
            Join VocabMaster today
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-warm-border bg-warm-surface p-6 shadow-sm">
          {/* Google sign-up */}
          <Button
            type="button"
            variant="outline"
            className="w-full border-warm-border bg-warm-bg hover:bg-warm-surface-2"
            onClick={handleGoogleSignup}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <svg className="mr-2 size-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign up with Google
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-warm-surface px-2 text-warm-text-subtle">or</span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-warm-text">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@makopan.edu.hk"
                className="border-warm-border bg-warm-bg focus:ring-warm-accent"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-warm-text">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="border-warm-border bg-warm-bg focus:ring-warm-accent"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-warm-text">Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="border-warm-border bg-warm-bg focus:ring-warm-accent"
              />
            </div>

            {error && (
              <p className="text-sm text-warm-wrong">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-warm-text text-warm-surface hover:bg-warm-accent"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <User className="mr-2 size-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-warm-text-subtle">
            Already have an account?{" "}
            <a href="/login" className="underline hover:text-warm-text-muted">
              Sign in
            </a>
          </p>

          <p className="mt-2 text-center text-xs text-warm-text-subtle">
            Only @makopan.edu.hk and @bunorden.com accounts are allowed.
          </p>

          <p className="mt-2 text-center text-xs text-warm-text-subtle">
            By continuing, you agree to the{" "}
            <a href="/privacy" className="underline hover:text-warm-text-muted">Privacy Policy</a>{" "}
            and{" "}
            <a href="/terms" className="underline hover:text-warm-text-muted">Terms of Use</a>.
          </p>
        </div>
      </motion.div>
    </main>
  );
}
