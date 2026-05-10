"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  Swords,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decrypt } from "@/lib/crypto";
import { pageTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface StudentInfo {
  name: string;
  className: string;
  classNum: string;
  lastActive: Date;
  joinedDate: Date;
}

interface ModuleProgress {
  moduleId: string;
  moduleTitle: string;
  score: number;
  cardsStudied: number;
  cardsTotal: number;
  completed: boolean;
  avgResponseMs: number;
  lastStudied: Date;
}

interface BattleRecord {
  battleId: string;
  moduleTitle: string;
  score: number;
  opponentScore: number;
  result: "win" | "loss" | "draw";
  date: Date;
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid: studentUid } = use(params);
  const router = useRouter();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [progress, setProgress] = useState<ModuleProgress[]>([]);
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData();
  }, [studentUid]);

  async function fetchStudentData() {
    try {
      // Fetch user doc
      const userSnap = await getDoc(doc(db, "users", studentUid));
      if (!userSnap.exists()) {
        setLoading(false);
        return;
      }
      const userData = userSnap.data();

      let name = "Unknown";
      let className = "";
      let classNum = "";

      try {
        name = await decrypt(userData.nameEnc as string);
        className = await decrypt(userData.classEnc as string);
        classNum = await decrypt(userData.classNumEnc as string);
      } catch {
        // Use defaults
      }

      setStudent({
        name,
        className,
        classNum,
        lastActive: userData.lastActive
          ? new Date((userData.lastActive as { seconds: number }).seconds * 1000)
          : new Date(),
        joinedDate: userData.createdAt
          ? new Date((userData.createdAt as { seconds: number }).seconds * 1000)
          : new Date(),
      });

      // Fetch progress
      const progressSnap = await getDocs(
        query(
          collection(db, "progress"),
          where("userId", "==", studentUid)
        )
      );

      const progressList: ModuleProgress[] = [];
      for (const pDoc of progressSnap.docs) {
        const pData = pDoc.data();
        let moduleTitle = "Unknown Module";

        try {
          const modSnap = await getDoc(doc(db, "modules", pData.moduleId as string));
          if (modSnap.exists()) {
            moduleTitle = (modSnap.data().title as string) ?? "Unknown Module";
          }
        } catch {
          // Use default
        }

        progressList.push({
          moduleId: pData.moduleId as string,
          moduleTitle,
          score: (pData.score as number) ?? 0,
          cardsStudied: (pData.cardsStudied as number) ?? 0,
          cardsTotal: (pData.cardsTotal as number) ?? 0,
          completed: pData.completedAt != null,
          avgResponseMs: (pData.avgResponseMs as number) ?? 0,
          lastStudied: pData.lastStudied
            ? new Date((pData.lastStudied as { seconds: number }).seconds * 1000)
            : new Date(0),
        });
      }
      progressList.sort((a, b) => b.lastStudied.getTime() - a.lastStudied.getTime());
      setProgress(progressList);

      // Fetch battle history
      const battlesSnap = await getDocs(
        query(
          collection(db, "battles"),
          where("status", "==", "finished")
        )
      );

      const battleList: BattleRecord[] = [];
      for (const bDoc of battlesSnap.docs) {
        const bData = bDoc.data();
        // Check if this student was in the battle
        try {
          const playersSnap = await getDocs(
            collection(db, "battles", bDoc.id, "players")
          );
          const studentPlayer = playersSnap.docs.find(
            (p) => p.id === studentUid
          );
          if (!studentPlayer) continue;

          const opponentPlayer = playersSnap.docs.find(
            (p) => p.id !== studentUid
          );
          const studentScore = (studentPlayer.data().score as number) ?? 0;
          const opponentScore = opponentPlayer
            ? ((opponentPlayer.data().score as number) ?? 0)
            : 0;

          let moduleTitle = "Unknown";
          try {
            const modSnap = await getDoc(doc(db, "modules", bData.moduleId as string));
            if (modSnap.exists()) {
              moduleTitle = (modSnap.data().title as string) ?? "Unknown";
            }
          } catch {
            // Use default
          }

          battleList.push({
            battleId: bDoc.id,
            moduleTitle,
            score: studentScore,
            opponentScore,
            result:
              studentScore > opponentScore
                ? "win"
                : studentScore < opponentScore
                ? "loss"
                : "draw",
            date: bData.createdAt
              ? new Date((bData.createdAt as { seconds: number }).seconds * 1000)
              : new Date(),
          });
        } catch {
          // Skip
        }
      }
      battleList.sort((a, b) => b.date.getTime() - a.date.getTime());
      setBattles(battleList.slice(0, 20));
    } catch (err) {
      console.error("Error fetching student data:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: Date) {
    if (d.getTime() === 0) return "N/A";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Calculate weak vocabulary (low score modules)
  const weakModules = progress.filter((p) => p.score < 60 && p.cardsStudied > 0);
  const overallScore =
    progress.length > 0
      ? Math.round(
          progress.reduce((sum, p) => sum + p.score, 0) / progress.length
        )
      : 0;
  const avgResponseTime =
    progress.length > 0
      ? Math.round(
          progress.reduce((sum, p) => sum + p.avgResponseMs, 0) / progress.length
        )
      : 0;

  if (loading) {
    return (
      <motion.div {...pageTransition} className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-warm-surface-2" />
            <div className="h-8 w-48 rounded bg-warm-surface-2" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-warm-surface-2" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-warm-surface-2" />
        </div>
      </motion.div>
    );
  }

  if (!student) {
    return (
      <motion.div {...pageTransition} className="flex flex-col items-center justify-center py-16">
        <p className="text-warm-text-muted">Student not found</p>
        <Button
          onClick={() => router.back()}
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="mr-2 size-4" />
          Go Back
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div {...pageTransition} className="space-y-6">
      {/* Back button + Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-2 text-warm-text-muted hover:text-warm-text"
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to Students
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-warm-accent text-xl font-bold text-white">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
              {student.name}
            </h1>
            <p className="text-warm-text-muted">
              {student.className} &middot; #{student.classNum} &middot; Joined{" "}
              {formatDate(student.joinedDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Target className="size-5 text-warm-accent" />
              <div>
                <p className="text-xs text-warm-text-muted">Overall Score</p>
                <p className="text-xl font-semibold text-warm-text">{overallScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <BookOpen className="size-5 text-blue-500" />
              <div>
                <p className="text-xs text-warm-text-muted">Modules Studied</p>
                <p className="text-xl font-semibold text-warm-text">
                  {progress.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-emerald-500" />
              <div>
                <p className="text-xs text-warm-text-muted">Avg Response</p>
                <p className="text-xl font-semibold text-warm-text">
                  {(avgResponseTime / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Swords className="size-5 text-teal-500" />
              <div>
                <p className="text-xs text-warm-text-muted">Battles</p>
                <p className="text-xl font-semibold text-warm-text">
                  {battles.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Progress */}
      <Card className="border-warm-border bg-warm-surface">
        <CardHeader className="border-b border-warm-border">
          <CardTitle className="text-warm-text">Module Progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {progress.length === 0 ? (
            <p className="py-8 text-center text-sm text-warm-text-muted">
              No module progress yet
            </p>
          ) : (
            <div className="space-y-3">
              {progress.map((p) => (
                <div
                  key={p.moduleId}
                  className="flex items-center gap-4 rounded-lg border border-warm-border bg-warm-surface-2 p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-warm-text">
                        {p.moduleTitle}
                      </p>
                      {p.completed && (
                        <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-warm-border">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          p.score >= 70
                            ? "bg-emerald-400"
                            : p.score >= 40
                            ? "bg-amber-400"
                            : "bg-red-400"
                        )}
                        style={{
                          width: `${Math.min(p.cardsTotal > 0 ? (p.cardsStudied / p.cardsTotal) * 100 : 0, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-warm-text">{p.score}%</p>
                    <p className="text-xs text-warm-text-muted">
                      {p.cardsStudied}/{p.cardsTotal} cards
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weak Areas */}
      {weakModules.length > 0 && (
        <Card className="border-warm-border bg-warm-surface">
          <CardHeader className="border-b border-warm-border">
            <CardTitle className="flex items-center gap-2 text-warm-text">
              <AlertTriangle className="size-4 text-amber-500" />
              Areas Needing Improvement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {weakModules.map((p) => (
                <div
                  key={p.moduleId}
                  className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"
                >
                  <span className="text-sm text-warm-text">{p.moduleTitle}</span>
                  <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                    {p.score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Battle History */}
      <Card className="border-warm-border bg-warm-surface">
        <CardHeader className="border-b border-warm-border">
          <CardTitle className="text-warm-text">Battle History</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {battles.length === 0 ? (
            <p className="py-8 text-center text-sm text-warm-text-muted">
              No battles played yet
            </p>
          ) : (
            <div className="space-y-2">
              {battles.map((b) => (
                <div
                  key={b.battleId}
                  className="flex items-center gap-3 rounded-lg border border-warm-border bg-warm-surface-2 p-3"
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-bold text-white",
                      b.result === "win"
                        ? "bg-emerald-500"
                        : b.result === "loss"
                        ? "bg-red-400"
                        : "bg-warm-text-muted"
                    )}
                  >
                    {b.result === "win" ? "W" : b.result === "loss" ? "L" : "D"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-warm-text">
                      {b.moduleTitle}
                    </p>
                    <p className="text-xs text-warm-text-muted">
                      {b.score} - {b.opponentScore} &middot;{" "}
                      {b.date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
