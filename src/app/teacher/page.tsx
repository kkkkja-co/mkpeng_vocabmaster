"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Crown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
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
import { Badge } from "@/components/ui/badge";
import { decrypt } from "@/lib/crypto";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface KpiCard {
  label: string;
  value: number;
  change: number;
  icon: React.ElementType;
  color: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: "study" | "battle" | "module" | "class";
}

interface TopPerformer {
  uid: string;
  name: string;
  score: number;
  modulesCompleted: number;
}

interface StrugglingStudent {
  uid: string;
  name: string;
  score: number;
  lastActive: string;
  reason: string;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-warm-surface-2" />
        <div className="flex-1">
          <div className="h-4 w-20 rounded bg-warm-surface-2" />
          <div className="mt-2 h-7 w-12 rounded bg-warm-surface-2" />
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { uid } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [struggling, setStruggling] = useState<StrugglingStudent[]>([]);

  useEffect(() => {
    if (!uid) return;

    async function fetchDashboard() {
      try {
        // Fetch students
        const studentsQ = query(
          collection(db, "users"),
          where("role", "==", "student")
        );
        const studentsSnap = await getDocs(studentsQ);
        const totalStudents = studentsSnap.size;

        // Count active today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTs = Timestamp.fromDate(todayStart);
        let activeToday = 0;
        studentsSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.lastActive && data.lastActive >= todayTs) {
            activeToday++;
          }
        });

        // Fetch modules by teacher
        const modulesQ = query(
          collection(db, "modules"),
          where("createdBy", "==", uid)
        );
        const modulesSnap = await getDocs(modulesQ);
        const publishedModules = modulesSnap.docs.filter(
          (d) => d.data().published === true
        ).length;

        // Fetch progress records
        const progressSnap = await getDocs(collection(db, "progress"));
        let totalScore = 0;
        let scoreCount = 0;
        const scoreMap: Record<string, number> = {};

        progressSnap.docs.forEach((doc) => {
          const data = doc.data();
          const score = (data.score as number) ?? 0;
          totalScore += score;
          scoreCount++;
          if (!scoreMap[data.userId] || scoreMap[data.userId] < score) {
            scoreMap[data.userId] = score;
          }
        });

        const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

        // Build KPI cards
        setKpis([
          {
            label: "Total Students",
            value: totalStudents,
            change: 0,
            icon: Users,
            color: "text-blue-500",
          },
          {
            label: "Active Today",
            value: activeToday,
            change: 0,
            icon: Activity,
            color: "text-emerald-500",
          },
          {
            label: "Modules Published",
            value: publishedModules,
            change: 0,
            icon: BookOpen,
            color: "text-warm-accent",
          },
          {
            label: "Average Score",
            value: avgScore,
            change: 0,
            icon: TrendingUp,
            color: "text-purple-500",
          },
        ]);

        // Build top performers
        const performers: TopPerformer[] = [];
        const sortedScores = Object.entries(scoreMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        for (const [userId, score] of sortedScores) {
          try {
            const userSnap = await getDocs(
              query(collection(db, "users"), where("__name__", "==", userId))
            );
            if (!userSnap.empty) {
              const userData = userSnap.docs[0].data();
              const name = await decrypt(userData.nameEnc as string);

              const userProgress = await getDocs(
                query(
                  collection(db, "progress"),
                  where("userId", "==", userId),
                  where("completedAt", "!=", null)
                )
              );

              performers.push({
                uid: userId,
                name,
                score,
                modulesCompleted: userProgress.size,
              });
            }
          } catch {
            // Skip decryption errors
          }
        }
        setTopPerformers(performers);

        // Build struggling students
        const now = Date.now();
        const sevenDaysAgo = Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000);
        const strugglers: StrugglingStudent[] = [];

        for (const docSnap of studentsSnap.docs) {
          const data = docSnap.data();
          const userScore = scoreMap[docSnap.id] ?? 0;
          const lastActive = data.lastActive as Timestamp | undefined;
          const isInactive = lastActive ? lastActive < sevenDaysAgo : true;
          const lowScore = userScore > 0 && userScore < 40;

          if (lowScore || isInactive) {
            try {
              const name = await decrypt(data.nameEnc as string);
              strugglers.push({
                uid: docSnap.id,
                name,
                score: userScore,
                lastActive: lastActive
                  ? new Date(lastActive.toMillis()).toLocaleDateString()
                  : "Never",
                reason: lowScore
                  ? `Low score: ${userScore}%`
                  : `Inactive since ${new Date(lastActive?.toMillis() ?? 0).toLocaleDateString()}`,
              });
            } catch {
              // Skip
            }
          }
        }
        setStruggling(strugglers.slice(0, 8));

        // Build activity feed (simple mock from recent progress)
        const recentProgress = await getDocs(
          query(
            collection(db, "progress"),
            orderBy("lastStudied", "desc"),
            limit(10)
          )
        );

        const feedItems: ActivityItem[] = [];
        for (const progDoc of recentProgress.docs) {
          const prog = progDoc.data();
          const lastStudied = prog.lastStudied as Timestamp | undefined;
          if (lastStudied) {
            try {
              const userSnap = await getDocs(
                query(collection(db, "users"), where("__name__", "==", prog.userId))
              );
              let studentName = "A student";
              if (!userSnap.empty) {
                studentName = await decrypt(userSnap.docs[0].data().nameEnc as string);
              }
              const timeDiff = now - lastStudied.toMillis();
              const hours = Math.floor(timeDiff / 3600000);
              const timeStr =
                hours < 1 ? "Just now" : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;

              feedItems.push({
                id: progDoc.id,
                text: `${studentName} scored ${prog.score}% on a module`,
                time: timeStr,
                type: "study",
              });
            } catch {
              // Skip
            }
          }
        }
        setActivities(feedItems.slice(0, 8));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [uid]);

  const activityIcon = (type: string) => {
    switch (type) {
      case "study":
        return <BookOpen className="size-4 text-warm-accent" />;
      case "battle":
        return <Activity className="size-4 text-teal-500" />;
      case "module":
        return <BookOpen className="size-4 text-blue-500" />;
      default:
        return <Clock className="size-4 text-warm-text-muted" />;
    }
  };

  return (
    <motion.div {...pageTransition} className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
          Dashboard
        </h1>
        <p className="mt-1 text-warm-text-muted">
          Overview of your teaching activity and student progress
        </p>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <motion.div key={kpi.label} variants={staggerItem}>
                  <Card className="border-warm-border bg-warm-surface">
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-warm-surface-2">
                            <Icon className={cn("size-5", kpi.color)} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-warm-text-muted">
                              {kpi.label}
                            </p>
                            <p className="text-2xl font-semibold text-warm-text">
                              {kpi.label === "Average Score"
                                ? `${kpi.value}%`
                                : kpi.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
      </motion.div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="border-warm-border bg-warm-surface lg:col-span-2">
          <CardHeader className="border-b border-warm-border">
            <CardTitle className="text-warm-text">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3">
                    <div className="size-8 rounded-full bg-warm-surface-2" />
                    <div className="flex-1">
                      <div className="h-3.5 w-40 rounded bg-warm-surface-2" />
                    </div>
                    <div className="h-3 w-12 rounded bg-warm-surface-2" />
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-warm-text-muted">
                No recent activity yet
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warm-surface-2">
                      {activityIcon(item.type)}
                    </div>
                    <p className="flex-1 text-sm text-warm-text">{item.text}</p>
                    <span className="shrink-0 text-xs text-warm-text-subtle">
                      {item.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="border-warm-border bg-warm-surface">
          <CardHeader className="border-b border-warm-border">
            <CardTitle className="flex items-center gap-2 text-warm-text">
              <Crown className="size-4 text-amber-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3">
                    <div className="size-8 rounded-full bg-warm-surface-2" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 rounded bg-warm-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topPerformers.length === 0 ? (
              <p className="py-8 text-center text-sm text-warm-text-muted">
                No data yet
              </p>
            ) : (
              <ul className="space-y-3">
                {topPerformers.map((p, idx) => (
                  <li key={p.uid} className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-warm-surface-2 text-xs font-semibold text-warm-text-muted">
                      {idx + 1}
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium text-warm-text">
                        {p.name}
                      </p>
                      <p className="text-xs text-warm-text-muted">
                        {p.modulesCompleted} modules completed
                      </p>
                    </div>
                    <Badge className="bg-warm-accent/10 text-warm-accent" variant="secondary">
                      {p.score}%
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Struggling Students */}
      <Card className="border-warm-border bg-warm-surface">
        <CardHeader className="border-b border-warm-border">
          <CardTitle className="flex items-center gap-2 text-warm-text">
            <AlertTriangle className="size-4 text-amber-500" />
            Students Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-warm-border bg-warm-surface-2 p-3">
                  <div className="h-4 w-24 rounded bg-warm-bg" />
                  <div className="mt-2 h-3 w-32 rounded bg-warm-bg" />
                </div>
              ))}
            </div>
          ) : struggling.length === 0 ? (
            <p className="py-8 text-center text-sm text-warm-text-muted">
              All students are doing well
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {struggling.map((s) => (
                <div
                  key={s.uid}
                  className="rounded-lg border border-warm-border bg-warm-surface-2 p-3 transition-colors hover:bg-warm-border/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-warm-wrong/10 text-xs font-bold text-warm-wrong">
                      {s.name.charAt(0)}
                    </div>
                    <p className="truncate text-sm font-medium text-warm-text">
                      {s.name}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-warm-text-muted">
                    {s.reason}
                  </p>
                  <p className="mt-1 text-xs text-warm-text-subtle">
                    Last active: {s.lastActive}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
