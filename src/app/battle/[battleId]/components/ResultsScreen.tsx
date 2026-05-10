"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BattleDoc, PlayerDoc } from "@/lib/guardrails";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Medal,
  RotateCcw,
  ArrowLeft,
  Flame,
} from "lucide-react";
import { pageTransition, springSnappy } from "@/lib/animations";

interface ResultsScreenProps {
  battleId: string;
  battle: BattleDoc;
  players: Record<string, PlayerDoc>;
  currentUid: string;
}

export function ResultsScreen({
  battleId,
  battle,
  players,
  currentUid,
}: ResultsScreenProps) {
  const router = useRouter();

  const sorted = useMemo(() => {
    return Object.entries(players)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.score - a.score);
  }, [players]);

  const myRank = sorted.findIndex((p) => p.id === currentUid);
  const myPlayer = sorted[myRank];

  // Fire confetti on mount for top 3
  useEffect(() => {
    const timer = setTimeout(() => {
      const end = Date.now() + 2000;
      const colors = ["#0d9488", "#cc785c", "#4ade80", "#f59e0b"];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handlePlayAgain = async () => {
    try {
      // Reset all players and battle state
      await updateDoc(doc(db, "battles", battleId), {
        status: "countdown",
        currentCardIndex: 0,
        currentCardStart: null,
      });

      // Reset all player scores
      for (const player of sorted) {
        await updateDoc(
          doc(db, "battles", battleId, "players", player.id),
          {
            score: 0,
            streak: 0,
            answeredCards: [],
            status: "ready",
            lastAnswerTime: null,
          }
        );
      }
    } catch (err) {
      console.error("Failed to restart:", err);
    }
  };

  const podiumData = sorted.slice(0, 3);
  const podiumOrder = [
    podiumData[1], // 2nd place (left)
    podiumData[0], // 1st place (center)
    podiumData[2], // 3rd place (right)
  ];
  const podiumHeights = [65, 85, 50]; // percentage heights
  const podiumLabels = ["2nd", "1st", "3rd"];
  const podiumColors = [
    "from-gray-300 to-gray-400",
    "from-amber-400 to-amber-500",
    "from-amber-600 to-amber-700",
  ];
  const podiumTextColors = ["text-gray-600", "text-amber-600", "text-amber-800"];

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-8">
      <motion.div
        className="mx-auto max-w-lg"
        {...pageTransition}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springSnappy, delay: 0.2 }}
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100"
          >
            <Trophy className="size-8 text-amber-500" />
          </motion.div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Battle Complete!
          </h1>
          {myRank >= 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-2 text-sm text-warm-text-muted"
            >
              You placed{" "}
              <span className="font-semibold text-warm-battle">
                #{myRank + 1}
              </span>{" "}
              with{" "}
              <span className="font-semibold text-warm-battle">
                {myPlayer?.score ?? 0} points
              </span>
            </motion.p>
          )}
        </div>

        {/* Podium */}
        <div className="mb-8 flex items-end justify-center gap-3 px-4">
          {podiumOrder.map((player, i) => {
            if (!player) return <div key={i} className="size-24" />;
            const isMe = player.id === currentUid;
            const [leftPlayer, centerPlayer, rightPlayer] = [
              podiumData[1],
              podiumData[0],
              podiumData[2],
            ];
            const actualPlayer = i === 0 ? leftPlayer : i === 1 ? centerPlayer : rightPlayer;
            if (!actualPlayer) return <div key={i} className="size-24" />;

            return (
              <motion.div
                key={actualPlayer.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: `${podiumHeights[i]}%`,
                  opacity: 1,
                }}
                transition={{
                  delay: 0.3 + i * 0.2,
                  duration: 0.6,
                  ease: "easeOut",
                }}
                className="flex w-24 flex-col items-center md:w-28"
              >
                {/* Player info */}
                <div className={`mb-2 text-center ${isMe ? "text-warm-battle" : ""}`}>
                  <div
                    className={`mx-auto mb-1 flex size-10 items-center justify-center rounded-full text-sm font-bold ${
                      i === 1
                        ? "bg-amber-100 text-amber-600"
                        : i === 0
                          ? "bg-gray-100 text-gray-500"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {actualPlayer.displayName.charAt(0)}
                  </div>
                  <p className="max-w-[5rem] truncate text-xs font-medium text-warm-text">
                    {actualPlayer.displayName}
                  </p>
                  <p className="font-[family-name:var(--font-mono)] text-xs font-semibold text-warm-text-muted">
                    {actualPlayer.score}
                  </p>
                </div>

                {/* Podium bar */}
                <div
                  className={`w-full rounded-t-lg bg-gradient-to-b ${podiumColors[i]} flex items-center justify-center`}
                  style={{ height: "100%", minHeight: "4rem" }}
                >
                  <div className="text-center">
                    {i === 1 ? (
                      <Medal className="mx-auto size-5 text-white drop-shadow" />
                    ) : null}
                    <span className="text-xs font-bold text-white drop-shadow">
                      {podiumLabels[i]}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Full Rankings */}
        <div className="mb-6 rounded-2xl border border-warm-border bg-[#faf7f2] p-4">
          <h2 className="mb-3 text-sm font-medium text-warm-text">
            Final Rankings
          </h2>
          <div className="space-y-2">
            {sorted.map((player, index) => {
              const isMe = player.id === currentUid;
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.08 }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                    isMe
                      ? "bg-warm-battle/10 ring-1 ring-warm-battle/20"
                      : ""
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-amber-100 text-amber-600"
                        : index === 1
                          ? "bg-gray-100 text-gray-500"
                          : index === 2
                            ? "bg-amber-50 text-amber-700"
                            : "bg-warm-surface-2 text-warm-text-subtle"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-warm-text">
                      {player.displayName}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-warm-battle">
                          (you)
                        </span>
                      )}
                    </p>
                  </div>
                  {player.streak >= 2 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                      <Flame className="size-3" />
                      {player.streak}
                    </span>
                  )}
                  <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-warm-text">
                    {player.score}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Your Score Breakdown */}
        {myPlayer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-6 rounded-2xl border border-warm-battle/20 bg-warm-battle-bg/30 p-4"
          >
            <h2 className="mb-3 text-sm font-medium text-warm-battle">
              Your Performance
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-warm-text">
                  {myPlayer.score}
                </p>
                <p className="text-xs text-warm-text-muted">Total Score</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-warm-text">
                  {myPlayer.answeredCards.length}
                </p>
                <p className="text-xs text-warm-text-muted">Cards Done</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-warm-text">
                  {myPlayer.streak}
                </p>
                <p className="text-xs text-warm-text-muted">Best Streak</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="space-y-3"
        >
          <Button
            onClick={handlePlayAgain}
            className="w-full h-12 bg-warm-battle text-white hover:bg-warm-battle/90 text-base font-medium"
          >
            <RotateCcw className="size-4 mr-2" />
            Play Again
          </Button>
          <Button
            onClick={() => router.push("/battle")}
            variant="outline"
            className="w-full h-12 border-warm-border text-warm-text hover:bg-warm-surface-2"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Lobby
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
