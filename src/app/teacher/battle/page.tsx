"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  Trophy,
  Clock,
  TrendingUp,
  Medal,
  Crown,
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

interface BattleRecord {
  id: string;
  moduleTitle: string;
  players: { name: string; score: number; uid: string }[];
  winner: string;
  date: Date;
  totalCards: number;
  timePerCard: number;
}

interface LeaderboardEntry {
  uid: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  avgScore: number;
  totalBattles: number;
}

interface ResponseTimeStat {
  label: string;
  value: string;
}

export default function BattleHistoryPage() {
  const { uid } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [responseStats, setResponseStats] = useState<ResponseTimeStat[]>([]);

  useEffect(() => {
    if (!uid) return;
    fetchBattleData();
  }, [uid]);

  async function fetchBattleData() {
    if (!uid) return;
    try {
      // Fetch finished battles
      const battlesSnap = await getDocs(
        query(
          collection(db(), "battles"),
          where("status", "==", "finished"),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      );

      const battleList: BattleRecord[] = [];
      const playerStats: Record<
        string,
        { name: string; wins: number; losses: number; draws: number; totalScore: number; count: number }
      > = {};

      for (const bDoc of battlesSnap.docs) {
        const bData = bDoc.data();

        // Get players
        const playersSnap = await getDocs(
          collection(db(), "battles", bDoc.id, "players")
        );

        const players = playersSnap.docs.map((p) => ({
          uid: p.id,
          name: p.data().displayName as string,
          score: (p.data().score as number) ?? 0,
        }));

        // Determine winner
        let winner = "draw";
        if (players.length >= 2) {
          if (players[0].score > players[1].score) winner = players[0].uid;
          else if (players[1].score > players[0].score) winner = players[1].uid;
        }

        // Get module title
        let moduleTitle = "Unknown";
        try {
          const modSnap = await getDocs(
            query(collection(db(), "modules"), where("__name__", "==", bData.moduleId))
          );
          if (!modSnap.empty) {
            moduleTitle = (modSnap.docs[0].data().title as string) ?? "Unknown";
          }
        } catch {
          // Use default
        }

        // Track stats
        for (const p of players) {
          if (!playerStats[p.uid]) {
            playerStats[p.uid] = {
              name: p.name,
              wins: 0,
              losses: 0,
              draws: 0,
              totalScore: 0,
              count: 0,
            };
          }
          playerStats[p.uid].totalScore += p.score;
          playerStats[p.uid].count++;

          if (p.uid === winner) playerStats[p.uid].wins++;
          else if (winner === "draw") playerStats[p.uid].draws++;
          else playerStats[p.uid].losses++;
        }

        const battleDate = bData.createdAt
          ? new Date((bData.createdAt as { seconds: number }).seconds * 1000)
          : new Date();

        battleList.push({
          id: bDoc.id,
          moduleTitle,
          players,
          winner,
          date: battleDate,
          totalCards: (bData.totalCards as number) ?? 0,
          timePerCard: (bData.timePerCard as number) ?? 15,
        });
      }

      setBattles(battleList);

      // Build leaderboard
      const lb = Object.entries(playerStats)
        .map(([uid, stats]) => ({
          uid,
          name: stats.name,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          avgScore:
            stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0,
          totalBattles: stats.wins + stats.losses + stats.draws,
        }))
        .sort((a, b) => b.wins - a.wins || b.avgScore - a.avgScore)
        .slice(0, 10);

      setLeaderboard(lb);

      // Response time stats (average)
      let totalTime = 0;
      let battleCount = 0;
      const timePerCardValues: number[] = [];
      for (const b of battleList) {
        if (b.timePerCard > 0) {
          timePerCardValues.push(b.timePerCard);
          totalTime += b.timePerCard;
          battleCount++;
        }
      }

      setResponseStats([
        {
          label: "Avg Time Per Card",
          value: battleCount > 0
            ? `${(totalTime / battleCount).toFixed(1)}s`
            : "N/A",
        },
        { label: "Total Battles", value: String(battleList.length) },
        {
          label: "Avg Players",
          value: battleCount > 0
            ? (
                battleList.reduce((sum, b) => sum + b.players.length, 0) /
                battleList.length
              ).toFixed(1)
            : "0",
        },
        {
          label: "Most Common Time",
          value:
            timePerCardValues.length > 0
              ? `${timePerCardValues.sort((a, b) => a - b)[Math.floor(timePerCardValues.length / 2)]}s`
              : "N/A",
        },
      ]);
    } catch (err) {
      console.error("Battle data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: Date) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <motion.div {...pageTransition} className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
          Battle History
        </h1>
        <p className="mt-1 text-warm-text-muted">
          Review past battles, leaderboards, and performance stats
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-4"
              >
                <div className="h-4 w-20 rounded bg-warm-surface-2" />
                <div className="mt-2 h-7 w-12 rounded bg-warm-surface-2" />
              </div>
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-warm-surface-2" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {responseStats.map((stat, idx) => (
              <Card key={idx} className="border-warm-border bg-warm-surface">
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-warm-text-muted">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-warm-text">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Battle List */}
            <div className="lg:col-span-2">
              <Card className="border-warm-border bg-warm-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warm-text">
                    <Swords className="size-4 text-teal-500" />
                    Recent Battles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {battles.length === 0 ? (
                    <p className="py-8 text-center text-sm text-warm-text-muted">
                      No battles played yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {battles.map((battle) => {
                        const isWinner = (uid: string) =>
                          battle.winner === uid;
                        const isTeacher = (uid: string) => false;

                        return (
                          <div
                            key={battle.id}
                            className="rounded-lg border border-warm-border bg-warm-surface-2 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-warm-text">
                                {battle.moduleTitle}
                              </span>
                              <span className="text-xs text-warm-text-subtle">
                                {formatDate(battle.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              {battle.players.map((player, pIdx) => (
                                <div
                                  key={player.uid}
                                  className="flex items-center gap-2"
                                >
                                  <div
                                    className={cn(
                                      "flex size-7 items-center justify-center rounded-full text-xs font-bold text-white",
                                      isWinner(player.uid)
                                        ? "bg-amber-400"
                                        : "bg-warm-text-muted"
                                    )}
                                  >
                                    {player.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-warm-text">
                                      {player.name}
                                    </p>
                                    <p className="text-xs text-warm-text-muted">
                                      {player.score} pts
                                    </p>
                                  </div>
                                  {pIdx < battle.players.length - 1 && (
                                    <span className="mx-1 text-xs font-bold text-warm-text-subtle">
                                      VS
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard */}
            <div>
              <Card className="border-warm-border bg-warm-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warm-text">
                    <Trophy className="size-4 text-amber-500" />
                    Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <p className="py-8 text-center text-sm text-warm-text-muted">
                      No leaderboard data
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {leaderboard.map((entry, idx) => (
                        <li key={entry.uid} className="flex items-center gap-3">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warm-surface-2 text-xs font-bold text-warm-text-muted">
                            {idx === 0 ? (
                              <Crown className="size-3.5 text-amber-500" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-warm-text">
                              {entry.name}
                            </p>
                            <p className="text-xs text-warm-text-muted">
                              {entry.wins}W / {entry.losses}L / {entry.draws}D
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-warm-text">
                              {entry.avgScore}%
                            </p>
                            <p className="text-[10px] text-warm-text-subtle">
                              avg score
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
