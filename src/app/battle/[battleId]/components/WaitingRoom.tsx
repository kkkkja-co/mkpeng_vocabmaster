"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BattleDoc, PlayerDoc } from "@/lib/guardrails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Users, Play, Swords } from "lucide-react";
import { springSnappy, staggerContainer, staggerItem } from "@/lib/animations";

interface WaitingRoomProps {
  battleId: string;
  battle: BattleDoc;
  players: Record<string, PlayerDoc>;
  currentUid: string;
}

export function WaitingRoom({
  battleId,
  battle,
  players,
  currentUid,
}: WaitingRoomProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHost = battle.hostId === currentUid;
  const playerList = Object.entries(players);
  const allReady = playerList.length >= 2 && playerList.every(([, p]) => p.status === "ready");

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(battle.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = async () => {
    if (!isHost || starting) return;
    setStarting(true);
    try {
      await updateDoc(doc(db(), "battles", battleId), {
        status: "countdown",
      });
    } catch (err) {
      console.error("Failed to start battle:", err);
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Back nav */}
      <motion.button
        onClick={() => router.push("/battle")}
        className="mb-6 flex items-center gap-1.5 text-sm text-warm-text-muted hover:text-warm-text transition-colors"
        whileHover={{ x: -2 }}
        whileTap={{ scale: 0.97 }}
      >
        Leave Room
      </motion.button>

      {/* Header */}
      <div className="mb-8 text-center">
        <motion.div
          className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-warm-battle/10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={springSnappy}
        >
          <Swords className="size-7 text-warm-battle" />
        </motion.div>
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-warm-text">
          Battle Room
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Waiting for players to join...
        </p>
      </div>

      {/* Invite Code */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSnappy}
        className="mb-6 rounded-2xl border-2 border-dashed border-warm-battle/30 bg-warm-battle-bg/50 p-6 text-center"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-warm-battle/70">
          Invite Code
        </p>
        <p className="font-[family-name:var(--font-mono)] text-4xl font-bold tracking-[0.4em] text-warm-battle">
          {battle.inviteCode}
        </p>
        <Button
          onClick={handleCopyCode}
          variant="outline"
          size="sm"
          className="mt-4 border-warm-battle/30 text-warm-battle hover:bg-warm-battle/10"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5"
              >
                <Check className="size-3.5" />
                Copied!
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5"
              >
                <Copy className="size-3.5" />
                Copy Code
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Player List */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-warm-text">
            <Users className="size-4 text-warm-text-muted" />
            Players
          </h2>
          <Badge variant="secondary" className="bg-warm-surface-2 text-warm-text-muted">
            {playerList.length} / 8
          </Badge>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-2"
        >
          <AnimatePresence>
            {playerList.map(([id, player]) => (
              <motion.div
                key={id}
                variants={staggerItem}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springSnappy}
                layout
                className="flex items-center justify-between rounded-xl border border-warm-border bg-[#faf7f2] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-warm-battle/10 text-xs font-bold text-warm-battle">
                    {player.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-text">
                      {player.displayName}
                      {id === currentUid && (
                        <span className="ml-1.5 text-xs text-warm-text-subtle">(you)</span>
                      )}
                    </p>
                    {player.class && (
                      <p className="text-xs text-warm-text-subtle">
                        {player.class}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={player.status === "ready" ? "default" : "secondary"}
                  className={
                    player.status === "ready"
                      ? "bg-warm-correct/20 text-green-700"
                      : "bg-warm-surface-2 text-warm-text-muted"
                  }
                >
                  {player.status === "ready" ? "Ready" : "Joined"}
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>

          {playerList.length === 0 && (
            <div className="rounded-xl border border-dashed border-warm-border bg-[#faf7f2] p-8 text-center">
              <Users className="mx-auto mb-2 size-8 text-warm-text-subtle/50" />
              <p className="text-sm text-warm-text-muted">
                Share the invite code to get players
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Start Button (host only) */}
      {isHost && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={handleStart}
            disabled={starting || playerList.length < 2}
            className="w-full h-12 bg-warm-battle text-white hover:bg-warm-battle/90 text-base font-medium"
          >
            {starting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Starting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="size-5" />
                Start Battle
              </span>
            )}
          </Button>
          {playerList.length < 2 && (
            <p className="mt-2 text-center text-xs text-warm-text-subtle">
              At least 2 players needed to start
            </p>
          )}
        </motion.div>
      )}

      {!isHost && (
        <div className="rounded-xl border border-warm-border bg-[#faf7f2] p-4 text-center">
          <p className="text-sm text-warm-text-muted">
            Waiting for the host to start the battle...
          </p>
        </div>
      )}
    </div>
  );
}
