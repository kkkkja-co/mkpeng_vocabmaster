"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthInit } from "@/hooks/use-auth-init";
import { getAllClasses } from "@/lib/firestore-helpers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Loader2, GraduationCap } from "lucide-react";
import { pageTransition } from "@/lib/animations";

interface ClassOption {
  id: string;
  name: string;
}

export default function SelectClassPage() {
  useAuthInit();
  const router = useRouter();
  const { uid, role, className, classNum, loading, updateClass } = useAuthStore();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedNum, setSelectedNum] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fetchingClasses, setFetchingClasses] = useState(true);

  useEffect(() => {
    if (!loading && (!uid || role !== "student")) {
      router.push("/login");
    }
  }, [uid, role, loading, router]);

  // Redirect if class is already set
  useEffect(() => {
    if (!loading && className && classNum) {
      router.push("/cards");
    }
  }, [className, classNum, loading, router]);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const allClasses = await getAllClasses();
        setClasses(allClasses.map((c) => ({ id: c.id, name: (c as Record<string, unknown>).name as string })));
      } catch {
        setError("Failed to load classes. Please try again.");
      } finally {
        setFetchingClasses(false);
      }
    }
    fetchClasses();
  }, []);

  const maxNum = 50;
  const numOptions = Array.from({ length: maxNum }, (_, i) => String(i + 1));

  const handleSubmit = async () => {
    if (!selectedClass || !selectedNum) {
      setError("Please select both class and class number.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateClass(selectedClass, selectedNum);
      router.push("/cards");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !uid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <Loader2 className="size-6 animate-spin text-warm-accent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-bg px-4 py-12">
      <motion.div className="w-full max-w-md" {...pageTransition}>
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-warm-accent/10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <GraduationCap className="size-8 text-warm-accent" />
          </motion.div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Select Your Class
          </h1>
          <p className="mt-1 text-sm text-warm-text-muted">
            Choose your class and class number. This cannot be changed later.
          </p>
        </div>

        <Card className="border-warm-border bg-warm-surface p-6 shadow-sm">
          {fetchingClasses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-warm-accent" />
            </div>
          ) : classes.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto mb-3 size-8 text-warm-text-subtle" />
              <p className="text-sm text-warm-text-muted">
                No classes available yet. Please contact your teacher.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-warm-text">Class</Label>
                <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "")}>
                  <SelectTrigger className="border-warm-border bg-warm-bg">
                    <SelectValue placeholder="Select your class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-warm-text">Class Number</Label>
                <Select value={selectedNum} onValueChange={(v) => setSelectedNum(v ?? "")}>
                  <SelectTrigger className="border-warm-border bg-warm-bg">
                    <SelectValue placeholder="Select your class number" />
                  </SelectTrigger>
                  <SelectContent>
                    {numOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        #{n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-warm-wrong">{error}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={saving || !selectedClass || !selectedNum}
                className="w-full bg-warm-text text-warm-surface hover:bg-warm-accent"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Confirm"
                )}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </main>
  );
}
