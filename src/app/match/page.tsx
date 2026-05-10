"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, orderBy, getDocs, query, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeCard, type CardDoc } from "@/lib/guardrails";
import { decrypt } from "@/lib/crypto";
import { getPublishedModules } from "@/lib/firestore-helpers";
import { pageTransition, springSnappy, springBouncy, staggerContainer, staggerItem } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Swords, Loader2, Trophy, Clock, RotateCcw } from "lucide-react";

interface MatchCard {
  id: string;
  text: string;
  pairId: string;
  type: "word" | "definition";
}

interface ModuleDocWithId {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  part: string;
  published: boolean;
  assignedClasses: string[];
  createdBy: string;
  createdAt: import("firebase/firestore").Timestamp;
  updatedAt: import("firebase/firestore").Timestamp;
  totalCards: number;
}

function docData(d: { data(): unknown }): Record<string, unknown> {
  return d.data() as Record<string, unknown>;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function MatchPage() {
  const uid = useAuthStore((s) => s.uid);

  const [modules, setModules] = useState<ModuleDocWithId[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);

  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);

  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [timer, setTimer] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);

  // Load modules
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mods = await getPublishedModules();
        if (!cancelled) {
          setModules(mods as ModuleDocWithId[]);
          if (mods.length > 0) setSelectedModuleId(mods[0].id);
        }
      } catch (err) {
        console.error("Failed to load modules:", err);
      } finally {
        if (!cancelled) setLoadingModules(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameFinished) return;
    const interval = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, gameFinished]);

  // Start game with selected module
  const startGame = useCallback(async () => {
    if (!selectedModuleId) return;
    setLoadingCards(true);
    setGameStarted(false);
    setGameFinished(false);
    setScore(0);
    setAttempts(0);
    setTimer(0);
    setSelectedId(null);
    setMatchedPairs(new Set());
    setWrongPair(null);

    try {
      const cardsRef = collection(db, "modules", selectedModuleId, "cards");
      const q = query(cardsRef, orderBy("order", "asc"));
      const snap = await getDocs(q);

      const rawCards = snap.docs.map((d) => ({
        raw: normalizeCard(docData(d)),
        id: d.id,
      }));

      // Take up to 8 pairs for a manageable game
      const selected = rawCards.slice(0, 8);

      const pairs: MatchCard[] = [];
      for (const { raw, id } of selected) {
        const definition = raw.definitionEnc ? await decrypt(raw.definitionEnc) : "";
        pairs.push({
          id: `${id}-word`,
          text: raw.word,
          pairId: id,
          type: "word",
        });
        pairs.push({
          id: `${id}-def`,
          text: definition,
          pairId: id,
          type: "definition",
        });
      }

      setMatchCards(shuffleArray(pairs));
      setGameStarted(true);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoadingCards(false);
    }
  }, [selectedModuleId]);

  // Handle card tap
  const handleCardTap = useCallback(
    (card: MatchCard) => {
      if (matchedPairs.has(card.pairId) || card.id === selectedId) return;

      if (selectedId === null) {
        setSelectedId(card.id);
        return;
      }

      const firstCard = matchCards.find((c) => c.id === selectedId);
      if (!firstCard) return;

      setAttempts((a) => a + 1);

      // Check match
      if (
        firstCard.pairId === card.pairId &&
        firstCard.type !== card.type
      ) {
        // Correct match
        setMatchedPairs((prev) => {
          const next = new Set(prev);
          next.add(card.pairId);
          return next;
        });
        setScore((s) => s + 10);
        setSelectedId(null);

        // Check if game finished
        const totalPairs = new Set(matchCards.map((c) => c.pairId)).size;
        if (matchedPairs.size + 1 >= totalPairs) {
          setGameFinished(true);
        }
      } else {
        // Wrong match
        setWrongPair([selectedId, card.id]);
        setSelectedId(null);
        setTimeout(() => setWrongPair(null), 600);
      }
    },
    [selectedId, matchedPairs, matchCards]
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loadingModules) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div className="flex flex-col items-center gap-3" {...pageTransition}>
          <Loader2 className="size-8 animate-spin text-warm-accent" />
          <p className="text-sm text-warm-text-muted">Loading modules...</p>
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
          Match Game
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Tap words and definitions to match them in pairs
        </p>
      </div>

      {/* Module Selector + Start */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={selectedModuleId} onValueChange={(v) => setSelectedModuleId(v ?? "")} disabled={gameStarted && !gameFinished}>
          <SelectTrigger className="w-full border-warm-border bg-warm-surface sm:w-72">
            <SelectValue placeholder="Select a module" />
          </SelectTrigger>
          <SelectContent>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!gameStarted || gameFinished ? (
          <Button
            onClick={startGame}
            disabled={loadingCards || !selectedModuleId}
            className="bg-warm-accent text-white hover:bg-warm-accent-dark"
          >
            {loadingCards ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Swords className="size-4" />
                {gameFinished ? "Play Again" : "Start Game"}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* Score / Timer Bar */}
      {gameStarted && (
        <motion.div
          className="mb-6 flex items-center justify-between rounded-xl border border-warm-border bg-warm-surface p-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-sm text-warm-text-muted">
            <Trophy className="size-4 text-warm-accent" />
            <span>
              Score: <span className="font-medium text-warm-text">{score}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-warm-text-muted">
            <Clock className="size-4" />
            <span className="font-mono">{formatTime(timer)}</span>
          </div>
          <div className="text-sm text-warm-text-muted">
            Matches:{" "}
            <span className="font-medium text-warm-text">
              {matchedPairs.size} / {new Set(matchCards.map((c) => c.pairId)).size}
            </span>
          </div>
        </motion.div>
      )}

      {/* Game Finished */}
      <AnimatePresence>
        {gameFinished && (
          <motion.div
            className="mb-6 rounded-2xl border border-warm-accent/30 bg-warm-surface p-6 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={springSnappy}
          >
            <Trophy className="mx-auto mb-2 size-10 text-warm-accent" />
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-warm-text">
              Well Done!
            </h2>
            <p className="mt-1 text-sm text-warm-text-muted">
              Completed in {formatTime(timer)} with {attempts} attempts
            </p>
            <p className="text-lg font-medium text-warm-accent">
              Final Score: {score}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match Grid */}
      {gameStarted && !loadingCards && (
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {matchCards.map((card) => {
            const isMatched = matchedPairs.has(card.pairId);
            const isSelected = selectedId === card.id;
            const isWrong = wrongPair?.includes(card.id);

            return (
              <motion.button
                key={card.id}
                variants={staggerItem}
                onClick={() => handleCardTap(card)}
                disabled={isMatched}
                className={`relative flex h-28 items-center justify-center rounded-xl border p-3 text-center text-sm transition-colors sm:h-32 ${
                  isMatched
                    ? "border-warm-correct/50 bg-warm-correct/10 text-warm-correct opacity-50"
                    : isWrong
                      ? "border-warm-wrong bg-warm-wrong/10"
                      : isSelected
                        ? "border-warm-accent bg-warm-accent/10 ring-2 ring-warm-accent/30"
                        : "border-warm-border bg-warm-surface hover:border-warm-accent/40 hover:bg-warm-surface-2"
                }`}
                whileHover={!isMatched ? { scale: 1.02 } : undefined}
                whileTap={!isMatched ? { scale: 0.97 } : undefined}
              >
                {isMatched ? (
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.2, 0.8] }}
                    transition={{ duration: 0.4 }}
                  >
                    <span className="text-lg">✓</span>
                  </motion.div>
                ) : (
                  <span
                    className={`leading-snug ${
                      card.type === "word"
                        ? "font-[family-name:var(--font-serif)] text-base font-medium text-warm-text"
                        : "text-warm-text-muted"
                    }`}
                  >
                    {card.text}
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Empty state */}
      {!gameStarted && !loadingModules && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-warm-text-subtle">Select a module and start the game</p>
        </div>
      )}
    </motion.div>
  );
}
