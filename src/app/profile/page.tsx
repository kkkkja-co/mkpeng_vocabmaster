"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeProgress, type ProgressDoc } from "@/lib/guardrails";
import { pageTransition, staggerContainer, staggerItem, springSnappy } from "@/lib/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  GraduationCap,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  CalendarDays,
} from "lucide-react";

interface ProgressWithModule extends ProgressDoc {
  id: string;
  moduleTitle: string;
}

function docData(d: { data(): Record<string, unknown> }): Record<string, unknown> {
  return d.data() as Record<string, unknown>;
}

function formatDate(ts: { toDate(): Date } | null): string {
  if (!ts) return "N/A";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

export default function ProfilePage() {
  const { uid, name, className, classNum, loading: authLoading } = useAuthStore();

  const [progress, setProgress] = useState<ProgressWithModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      try {
        const q = query(
          collection(db(), "progress"),
          where("userId", "==", uid),
          orderBy("lastStudied", "desc")
        );
        const snap = await getDocs(q);

        const items: ProgressWithModule[] = await Promise.all(
          snap.docs.map(async (d) => {
            const data = normalizeProgress(docData(d));
            // Fetch module title
            let moduleTitle = "Unknown Module";
            try {
              const { doc, getDoc } = await import("firebase/firestore");
              const modSnap = await getDoc(doc(db(), "modules", data.moduleId));
              if (modSnap.exists()) {
                moduleTitle = (modSnap.data().title as string) ?? "Unknown Module";
              }
            } catch {
              // ignore
            }
            return { ...data, id: d.id, moduleTitle };
          })
        );

        if (!cancelled) setProgress(items);
      } catch (err) {
        console.error("Failed to load progress:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  // Aggregate stats
  const totalCardsStudied = progress.reduce((sum, p) => sum + p.cardsStudied, 0);
  const totalCorrect = progress.reduce((sum, p) => sum + p.correctCount, 0);
  const totalWrong = progress.reduce((sum, p) => sum + p.wrongCount, 0);
  const averageScore =
    progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
      : 0;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div className="flex flex-col items-center gap-3" {...pageTransition}>
          <Loader2 className="size-8 animate-spin text-warm-accent" />
          <p className="text-sm text-warm-text-muted">Loading profile...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="mx-auto max-w-3xl px-4 py-6 md:py-10"
      {...pageTransition}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-normal text-warm-text md:text-3xl">
          My Profile
        </h1>
      </div>

      {/* Student Info Card */}
      <Card className="mb-6 border-warm-border bg-warm-surface">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-14 items-center justify-center rounded-full bg-warm-accent/10">
            <User className="size-7 text-warm-accent" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-warm-text">{name || "Student"}</h2>
            <div className="flex items-center gap-2 text-sm text-warm-text-muted">
              <GraduationCap className="size-4" />
              <span>
                {className || "N/A"} &middot; #{classNum || "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <BookOpen className="size-5 text-warm-accent" />
            <span className="text-2xl font-medium text-warm-text">{totalCardsStudied}</span>
            <span className="text-xs text-warm-text-muted">Cards Studied</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <CheckCircle className="size-5 text-warm-correct" />
            <span className="text-2xl font-medium text-warm-text">{totalCorrect}</span>
            <span className="text-xs text-warm-text-muted">Correct</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <XCircle className="size-5 text-warm-wrong" />
            <span className="text-2xl font-medium text-warm-text">{totalWrong}</span>
            <span className="text-xs text-warm-text-muted">Wrong</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <TrendingUp className="size-5 text-warm-accent" />
            <span className="text-2xl font-medium text-warm-text">{averageScore}%</span>
            <span className="text-xs text-warm-text-muted">Avg Score</span>
          </CardContent>
        </Card>
      </div>

      {/* Module Progress */}
      <h2 className="mb-3 text-lg font-medium text-warm-text">Progress by Module</h2>
      {progress.length === 0 ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <BookOpen className="size-10 text-warm-text-subtle" />
            <p className="text-sm text-warm-text-muted">
              No progress yet. Start studying to see your progress here!
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {progress.map((p) => {
            const progressPercent =
              p.cardsTotal > 0 ? Math.round((p.cardsStudied / p.cardsTotal) * 100) : 0;

            return (
              <motion.div key={p.id} variants={staggerItem}>
                <Card className="border-warm-border bg-warm-surface">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-warm-text">
                        {p.moduleTitle}
                      </h3>
                      <span className="text-sm font-medium text-warm-accent">
                        {p.score}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-warm-surface-2">
                      <motion.div
                        className="h-full rounded-full bg-warm-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={springSnappy}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-warm-text-muted">
                      <span className="flex items-center gap-1">
                        <BookOpen className="size-3" />
                        {p.cardsStudied}/{p.cardsTotal} cards
                      </span>
                      <span className="flex items-center gap-1 text-warm-correct">
                        <CheckCircle className="size-3" />
                        {p.correctCount} correct
                      </span>
                      <span className="flex items-center gap-1 text-warm-wrong">
                        <XCircle className="size-3" />
                        {p.wrongCount} wrong
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(p.lastStudied)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
