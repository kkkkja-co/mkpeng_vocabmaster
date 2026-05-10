"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { decrypt } from "@/lib/crypto";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface DailyActivity {
  date: string;
  count: number;
  label: string;
}

interface ScoreBucket {
  range: string;
  count: number;
  color: string;
}

interface ModuleCompletion {
  moduleId: string;
  title: string;
  totalStudents: number;
  completions: number;
  rate: number;
}

interface MissedWord {
  word: string;
  wrongCount: number;
  totalCount: number;
  errorRate: number;
}

export default function AnalyticsPage() {
  const { uid } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreBucket[]>([]);
  const [moduleCompletions, setModuleCompletions] = useState<ModuleCompletion[]>([]);
  const [missedWords, setMissedWords] = useState<MissedWord[]>([]);

  useEffect(() => {
    if (!uid) return;
    fetchAnalytics();
  }, [uid]);

  async function fetchAnalytics() {
    if (!uid) return;
    try {
      // Fetch all progress records
      const progressSnap = await getDocs(collection(db, "progress"));
      const allProgress = progressSnap.docs.map((d) => d.data());

      // Fetch modules by teacher for completions
      const modulesSnap = await getDocs(
        query(
          collection(db, "modules"),
          where("createdBy", "==", uid),
          where("published", "==", true)
        )
      );

      // ── Daily Activity (last 7 days) ──
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const dailyData: DailyActivity[] = [];

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now - i * dayMs);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const startTs = Timestamp.fromDate(dayStart);
        const endTs = Timestamp.fromDate(dayEnd);

        let count = 0;
        allProgress.forEach((p) => {
          const lastStudied = p.lastStudied as Timestamp | undefined;
          if (lastStudied && lastStudied >= startTs && lastStudied <= endTs) {
            count++;
          }
        });

        dailyData.push({
          date: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
          count,
          label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        });
      }
      setDailyActivity(dailyData);

      // ── Score Distribution ──
      const buckets: ScoreBucket[] = [
        { range: "0-20%", count: 0, color: "bg-red-400" },
        { range: "21-40%", count: 0, color: "bg-orange-400" },
        { range: "41-60%", count: 0, color: "bg-amber-400" },
        { range: "61-80%", count: 0, color: "bg-emerald-300" },
        { range: "81-100%", count: 0, color: "bg-emerald-500" },
      ];

      allProgress.forEach((p) => {
        const score = (p.score as number) ?? 0;
        if (score <= 20) buckets[0].count++;
        else if (score <= 40) buckets[1].count++;
        else if (score <= 60) buckets[2].count++;
        else if (score <= 80) buckets[3].count++;
        else buckets[4].count++;
      });
      setScoreDistribution(buckets);

      // ── Module Completions ──
      const completions: ModuleCompletion[] = [];
      for (const mDoc of modulesSnap.docs) {
        const mData = mDoc.data();
        const moduleId = mDoc.id;

        const modProgress = allProgress.filter(
          (p) => p.moduleId === moduleId
        );
        const totalStudents = new Set(modProgress.map((p) => p.userId)).size;
        const completionsCount = modProgress.filter(
          (p) => p.completedAt != null
        ).length;
        const rate =
          totalStudents > 0
            ? Math.round((completionsCount / totalStudents) * 100)
            : 0;

        completions.push({
          moduleId,
          title: (mData.title as string) ?? "Untitled",
          totalStudents,
          completions: completionsCount,
          rate,
        });
      }
      completions.sort((a, b) => b.rate - a.rate);
      setModuleCompletions(completions);

      // ── Most Missed Vocabulary (aggregate wrong counts) ──
      // This is approximate - we look at scores per module and derive
      const wordErrors: Record<string, { wrong: number; total: number }> = {};

      allProgress.forEach((p) => {
        const wrong = (p.wrongCount as number) ?? 0;
        const correct = (p.correctCount as number) ?? 0;
        const total = wrong + correct;

        // Use moduleId as a proxy for "module progress"
        if (total > 0) {
          // We don't have per-word data in progress, but we can aggregate
          // For demonstration, show modules with highest error rates
          const key = (p.moduleId as string) ?? "unknown";
          if (!wordErrors[key]) {
            wordErrors[key] = { wrong: 0, total: 0 };
          }
          wordErrors[key].wrong += wrong;
          wordErrors[key].total += total;
        }
      });

      // Fetch module titles for the error data
      const missedList: MissedWord[] = [];
      const sortedErrors = Object.entries(wordErrors)
        .sort(([, a], [, b]) => {
          const rateA = a.total > 0 ? a.wrong / a.total : 0;
          const rateB = b.total > 0 ? b.wrong / b.total : 0;
          return rateB - rateA;
        })
        .slice(0, 8);

      for (const [moduleId, data] of sortedErrors) {
        let title = "Unknown";
        try {
          const modSnap = await getDocs(
            query(collection(db, "modules"), where("__name__", "==", moduleId))
          );
          if (!modSnap.empty) {
            title = (modSnap.docs[0].data().title as string) ?? "Unknown";
          }
        } catch {
          // Use default
        }

        missedList.push({
          word: title,
          wrongCount: data.wrong,
          totalCount: data.total,
          errorRate: Math.round((data.wrong / data.total) * 100),
        });
      }
      setMissedWords(missedList);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const maxDaily = Math.max(...dailyActivity.map((d) => d.count), 1);
  const maxBucket = Math.max(...scoreDistribution.map((b) => b.count), 1);

  return (
    <motion.div {...pageTransition} className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
          Analytics
        </h1>
        <p className="mt-1 text-warm-text-muted">
          Insights into student performance and engagement
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-6"
            >
              <div className="mb-4 h-5 w-32 rounded bg-warm-surface-2" />
              <div className="h-48 rounded bg-warm-surface-2" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          {/* Daily Active Students (Bar Chart) */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-warm-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <Users className="size-4 text-warm-accent" />
                  Daily Activity (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2" style={{ height: 180 }}>
                  {dailyActivity.map((day, idx) => (
                    <div
                      key={idx}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <span className="text-xs font-medium text-warm-text-muted">
                        {day.count}
                      </span>
                      <div
                        className="w-full rounded-t-lg bg-warm-accent transition-all"
                        style={{
                          height: `${Math.max((day.count / maxDaily) * 120, 4)}px`,
                        }}
                      />
                      <span className="text-[10px] text-warm-text-subtle">
                        {day.date}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Score Distribution (Horizontal Bars) */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-warm-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <Target className="size-4 text-warm-accent" />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scoreDistribution.map((bucket, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-right text-xs font-medium text-warm-text-muted">
                        {bucket.range}
                      </span>
                      <div className="flex-1">
                        <div className="h-6 w-full overflow-hidden rounded bg-warm-surface-2">
                          <div
                            className={cn("h-full rounded transition-all", bucket.color)}
                            style={{
                              width: `${Math.max((bucket.count / maxBucket) * 100, bucket.count > 0 ? 8 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-xs font-medium text-warm-text">
                        {bucket.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Module Completion Rates */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-warm-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <TrendingUp className="size-4 text-warm-accent" />
                  Module Completion Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moduleCompletions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-warm-text-muted">
                    No published modules yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {moduleCompletions.map((mc) => (
                      <div key={mc.moduleId}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="truncate text-sm text-warm-text">
                            {mc.title}
                          </span>
                          <span className="shrink-0 text-xs font-medium text-warm-text-muted">
                            {mc.rate}% ({mc.completions}/{mc.totalStudents})
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-warm-surface-2">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              mc.rate >= 70
                                ? "bg-emerald-400"
                                : mc.rate >= 40
                                ? "bg-amber-400"
                                : "bg-red-400"
                            )}
                            style={{ width: `${mc.rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Most Missed Vocabulary */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-warm-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Modules with Highest Error Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {missedWords.length === 0 ? (
                  <p className="py-8 text-center text-sm text-warm-text-muted">
                    No data yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {missedWords.map((mw, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-lg border border-warm-border bg-warm-surface-2 p-3"
                      >
                        <span className="w-6 shrink-0 text-center text-xs font-bold text-warm-text-muted">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-warm-text">
                            {mw.word}
                          </p>
                          <p className="text-xs text-warm-text-muted">
                            {mw.wrongCount}/{mw.totalCount} incorrect
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            mw.errorRate >= 50
                              ? "text-red-500"
                              : mw.errorRate >= 30
                              ? "text-amber-500"
                              : "text-warm-text-muted"
                          )}
                        >
                          {mw.errorRate}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
