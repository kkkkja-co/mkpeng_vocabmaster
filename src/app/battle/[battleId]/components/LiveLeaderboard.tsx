"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { PlayerDoc } from "@/lib/guardrails";
import { Trophy, Flame } from "lucide-react";

interface LiveLeaderboardProps {
  players: Record<string, PlayerDoc>;
  currentUid: string;
}

export function LiveLeaderboard({ players, currentUid }: LiveLeaderboardProps) {
  const sorted = useMemo(() => {
    return Object.entries(players)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.score - a.score);
  }, [players]);

  const rankColors = ["text-amber-500", "text-gray-400", "text-amber-700"];

  return (
    <div className="rounded-xl border border-warm-border bg-[#faf7f2] p-3">
      <h3 className="mb-3 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
        <Trophy className="size-3.5" />
        Leaderboard
      </h3>
      <div className="space-y-1.5">
        {sorted.map((player, index) => {
          const isMe = player.id === currentUid;
          return (
            <motion.div
              key={player.id}
              layout
              layoutId={player.id}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                isMe
                  ? "bg-warm-battle/10 ring-1 ring-warm-battle/20"
                  : "hover:bg-warm-surface-2/50"
              }`}
            >
              {/* Rank */}
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  index < 3
                    ? `${rankColors[index]} bg-current/10`
                    : "text-warm-text-subtle bg-warm-surface-2"
                }`}
              >
                {index + 1}
              </span>

              {/* Name */}
              <span className="flex-1 truncate font-medium text-warm-text">
                {player.displayName}
                {isMe && (
                  <span className="ml-1 text-[10px] text-warm-battle">
                    (you)
                  </span>
                )}
              </span>

              {/* Streak indicator */}
              {player.streak >= 2 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-0.5 text-[10px] text-orange-500"
                >
                  <Flame className="size-3" />
                  {player.streak}
                </motion.span>
              )}

              {/* Score */}
              <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-warm-text">
                {player.score}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
