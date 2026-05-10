"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, GraduationCap, Loader2 } from "lucide-react";
import { springSnappy, pageTransition } from "@/lib/animations";

interface ClassItem {
  id: string;
  name: string;
}

export default function LoginPage() {
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [classNum, setClassNum] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { studentLogin, teacherLogin, uid, role } = useAuthStore();

  // Fetch classes in real time (only after Firebase is configured)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
    const unsub = onSnapshot(collection(db, "classes"), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
      setClasses(items);
    }, () => {});
    return unsub;
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (uid && !loading) {
      if (role === "teacher") {
        router.push("/teacher");
      } else if (role === "student") {
        router.push("/cards");
      }
    }
  }, [uid, role, router]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedClass || !classNum || !name.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const classObj = classes.find((c) => c.id === selectedClass);
      await studentLogin(name.trim(), classObj?.name ?? selectedClass, classNum);
      router.push("/cards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await teacherLogin(email, password);
      router.push("/teacher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            VocabMaster
          </h1>
          <p className="mt-1 text-sm text-warm-text-muted">
            Your vocabulary learning companion
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex justify-center">
          <div className="flex rounded-full bg-warm-surface-2 p-1">
            {(["student", "teacher"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-warm-text text-warm-surface shadow-sm"
                    : "text-warm-text-muted hover:text-warm-text"
                }`}
              >
                {t === "student" ? (
                  <GraduationCap className="size-4" />
                ) : (
                  <BookOpen className="size-4" />
                )}
                {t === "student" ? "Student" : "Teacher"}
              </button>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-warm-border bg-warm-surface p-6 shadow-sm">
          <AnimatePresence mode="wait">
            {tab === "student" ? (
              <motion.form
                key="student"
                onSubmit={handleStudentLogin}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={springSnappy}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-warm-text">Class</Label>
                  <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "")}>
                    <SelectTrigger className="border-warm-border bg-warm-bg">
                      <SelectValue placeholder="Select your class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                      {classes.length === 0 && (
                        <SelectItem value="none" disabled>
                          No classes available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-warm-text">Class Number</Label>
                  <Select value={classNum} onValueChange={(v) => setClassNum(v ?? "")}>
                    <SelectTrigger className="border-warm-border bg-warm-bg">
                      <SelectValue placeholder="Select your number" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 40 }, (_, i) => {
                        const num = String(i + 1).padStart(2, "0");
                        return (
                          <SelectItem key={num} value={num}>
                            {num}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-warm-text">English Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your English name"
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
                    "Sign In"
                  )}
                </Button>

                <p className="text-center text-xs text-warm-text-subtle">
                  By continuing, you agree to the{" "}
                  <a href="/privacy" className="underline hover:text-warm-text-muted">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="/terms" className="underline hover:text-warm-text-muted">Terms of Use</a>.
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="teacher"
                onSubmit={handleTeacherLogin}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={springSnappy}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-warm-text">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.edu"
                    className="border-warm-border bg-warm-bg focus:ring-warm-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-warm-text">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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
                    "Sign In as Teacher"
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}
