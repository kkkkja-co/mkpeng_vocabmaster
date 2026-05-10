"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc,
  onSnapshot,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import {
  normalizeBattle,
  normalizePlayer,
  type BattleDoc,
  type PlayerDoc,
} from "@/lib/guardrails";
import { WaitingRoom } from "./components/WaitingRoom";
import { BattleCountdown } from "./components/BattleCountdown";
import { BattleArena } from "./components/BattleArena";
import { SpellingBattle } from "./components/SpellingBattle";
import { ResultsScreen } from "./components/ResultsScreen";
import { Loader2 } from "lucide-react";
import { pageTransition } from "@/lib/animations";
import { toast } from "sonner";

export default function BattleRoomPage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = use(params);
  const router = useRouter();
  const { uid } = useAuthStore();

  const [battle, setBattle] = useState<BattleDoc | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerDoc>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prevStatus, setPrevStatus] = useState<BattleDoc["status"] | null>(null);

  // Subscribe to battle document
  useEffect(() => {
    if (!battleId) return;

    const unsub = onSnapshot(
      doc(db(), "battles", battleId),
      (snap) => {
        if (!snap.exists()) {
          setError("Battle not found");
          setLoading(false);
          return;
        }
        const newBattle = normalizeBattle(snap.data() as Record<string, unknown>);

        // Detect challenge denied
        if (prevStatus === "challenge_sent" && newBattle.status === "challenge_denied") {
          toast.error("Challenge denied!", {
            description: "Your opponent declined the challenge.",
            duration: 5000,
          });
          setTimeout(() => router.push("/battle"), 3000);
        }

        setPrevStatus(newBattle.status);
        setBattle(newBattle);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [battleId, prevStatus, router]);

  // Subscribe to players subcollection
  useEffect(() => {
    if (!battleId) return;

    const unsub = onSnapshot(
      collection(db(), "battles", battleId, "players"),
      (snap) => {
        const map: Record<string, PlayerDoc> = {};
        snap.docs.forEach((d) => {
          map[d.id] = normalizePlayer(d.data() as Record<string, unknown>);
        });
        setPlayers(map);
      }
    );

    return unsub;
  }, [battleId]);

  // Redirect to lobby if not authenticated
  useEffect(() => {
    if (!loading && !uid) {
      router.push("/battle");
    }
  }, [loading, uid, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8]">
        <motion.div {...pageTransition} className="text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-warm-battle" />
          <p className="text-sm text-warm-text-muted">Loading battle...</p>
        </motion.div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8]">
        <motion.div {...pageTransition} className="text-center">
          <p className="mb-4 text-lg text-warm-text">{error}</p>
          <button
            onClick={() => router.push("/battle")}
            className="text-sm text-warm-accent hover:underline"
          >
            Back to lobby
          </button>
        </motion.div>
      </main>
    );
  }

  if (!battle || !uid) return null;

  const isSpellingBattle = battle.battleType === "spelling";

  return (
    <main className="min-h-screen bg-[#f5f0e8]">
      <AnimatePresence mode="wait">
        {battle.status === "waiting" && (
          <motion.div key="waiting" {...pageTransition}>
            <WaitingRoom
              battleId={battleId}
              battle={battle}
              players={players}
              currentUid={uid}
            />
          </motion.div>
        )}

        {battle.status === "challenge_sent" && (
          <motion.div key="challenge_sent" {...pageTransition}>
            <WaitingRoom
              battleId={battleId}
              battle={battle}
              players={players}
              currentUid={uid}
            />
          </motion.div>
        )}

        {battle.status === "countdown" && (
          <motion.div key="countdown" {...pageTransition}>
            <BattleCountdown battleId={battleId} battle={battle} />
          </motion.div>
        )}

        {battle.status === "active" && (
          <motion.div key="active" {...pageTransition}>
            {isSpellingBattle ? (
              <SpellingBattle
                battleId={battleId}
                battle={battle}
                players={players}
                currentUid={uid}
              />
            ) : (
              <BattleArena
                battleId={battleId}
                battle={battle}
                players={players}
                currentUid={uid}
              />
            )}
          </motion.div>
        )}

        {battle.status === "finished" && (
          <motion.div key="finished" {...pageTransition}>
            <ResultsScreen
              battleId={battleId}
              battle={battle}
              players={players}
              currentUid={uid}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
