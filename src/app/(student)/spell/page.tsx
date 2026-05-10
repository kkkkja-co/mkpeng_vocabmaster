"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, orderBy, getDocs, query, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeCard } from "@/lib/guardrails";
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SpellCheck,
  Loader2,
  Check,
  X,
  Volume2,
  RotateCcw,
  Timer,
  Trophy,
  SkipForward,
  Zap,
} from "lucide-react";
import { addWordToCollection } from "@/lib/collections";

interface SpellItem {
  id: string;
  word: string;
  definition: string;
  chineseMeaning: string;
  partTag: string;
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

type PartFilter = "all" | "A" | "B1" | "B2";

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

const GAME_DURATION = 60;
const POINTS_PER_WORD = 10;

export default function SpellPage() {
  const uid = useAuthStore((s) => s.uid);

  const [modules, setModules] = useState<ModuleDocWithId[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [partFilter, setPartFilter] = useState<PartFilter>("all");

  const [allCards, setAllCards] = useState<SpellItem[]>([]);
  const [filteredCards, setFilteredCards] = useState<SpellItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const [personalBest, setPersonalBest] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCard = filteredCards[currentIndex];

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

  // Load high scores when module changes
  useEffect(() => {
    if (!selectedModuleId || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        // Personal best
        const progressId = `${uid}_${selectedModuleId}_spell`;
        const progressSnap = await getDoc(doc(db(), "progress", progressId));
        if (!cancelled && progressSnap.exists()) {
          const data = progressSnap.data();
          setPersonalBest((data.personalBest as number) ?? 0);
        }

        // Global best
        const globalSnap = await getDoc(doc(db(), "progress", `global_spell_${selectedModuleId}`));
        if (!cancelled && globalSnap.exists()) {
          const data = globalSnap.data();
          setBestScore((data.bestScore as number) ?? 0);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [selectedModuleId, uid]);

  // Apply part filter
  useEffect(() => {
    if (partFilter === "all") {
      setFilteredCards(allCards);
    } else {
      setFilteredCards(
        allCards.filter((c) => {
          const tag = (c.partTag || "").toUpperCase();
          if (partFilter === "A") return tag === "A" || tag === "PART A";
          if (partFilter === "B1") return tag === "B1" || tag === "PART B1";
          if (partFilter === "B2") return tag === "B2" || tag === "PART B2";
          return true;
        })
      );
    }
    setCurrentIndex(0);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);
  }, [partFilter, allCards]);

  // Load cards
  const loadCards = useCallback(async () => {
    if (!selectedModuleId) return;
    setLoadingCards(true);
    try {
      const cardsRef = collection(db(), "modules", selectedModuleId, "cards");
      const q = query(cardsRef, orderBy("order", "asc"));
      const snap = await getDocs(q);

      const items: SpellItem[] = await Promise.all(
        snap.docs.map(async (d) => {
          const raw = normalizeCard(docData(d));
          const [definition, chineseMeaning] = await Promise.all([
            raw.definitionEnc ? decrypt(raw.definitionEnc) : "",
            raw.chineseMeaningEnc ? decrypt(raw.chineseMeaningEnc) : "",
          ]);
          return { id: d.id, word: raw.word, definition, chineseMeaning, partTag: raw.partTag };
        })
      );

      setAllCards(items);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoadingCards(false);
    }
  }, [selectedModuleId]);

  // Load cards when module changes
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Start game
  const startGame = useCallback(() => {
    if (filteredCards.length === 0) return;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCurrentIndex(0);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);
    setGameStarted(true);
    setGameFinished(false);

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, [filteredCards.length]);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameFinished(true);
          setGameStarted(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameFinished]);

  // Save high scores on game finish
  useEffect(() => {
    if (!gameFinished || !uid || !selectedModuleId) return;

    (async () => {
      try {
        const newPersonalBest = Math.max(personalBest, score);
        setPersonalBest(newPersonalBest);

        const progressId = `${uid}_${selectedModuleId}_spell`;
        await setDoc(
          doc(db(), "progress", progressId),
          {
            userId: uid,
            moduleId: selectedModuleId,
            personalBest: newPersonalBest,
            lastPlayed: serverTimestamp(),
          },
          { merge: true }
        );

        // Update global best
        if (score > bestScore) {
          setBestScore(score);
          await setDoc(
            doc(db(), "progress", `global_spell_${selectedModuleId}`),
            {
              bestScore: score,
              bestPlayer: uid,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("Failed to save high scores:", err);
      }
    })();
  }, [gameFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus input
  useEffect(() => {
    if (gameStarted && !gameFinished && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, gameStarted, gameFinished, feedback]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback !== null || !currentCard || !gameStarted) return;

    const isCorrect = input.trim().toLowerCase() === currentCard.word.toLowerCase();
    setFeedback(isCorrect ? "correct" : "wrong");
    setShowAnswer(!isCorrect);

    if (isCorrect) {
      setScore((s) => s + POINTS_PER_WORD);

      // Collect word
      if (uid && selectedModuleId) {
        addWordToCollection(
          uid,
          selectedModuleId,
          currentCard.id,
          currentCard.word,
          currentCard.definition,
          "" // spell page doesn't load example sentences
        ).catch(() => {});
      }
    }

    // Auto-advance after delay
    feedbackTimeoutRef.current = setTimeout(() => {
      handleNext();
    }, isCorrect ? 600 : 1200);
  };

  const handleNext = useCallback(() => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setInput("");
      setFeedback(null);
      setShowAnswer(false);
    } else {
      // Wrap around
      setCurrentIndex(0);
      setInput("");
      setFeedback(null);
      setShowAnswer(false);
    }
  }, [currentIndex, filteredCards.length]);

  const handleSkip = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    handleNext();
  }, [handleNext]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor =
    timerPercent > 50
      ? "bg-warm-accent"
      : timerPercent > 25
        ? "bg-amber-500"
        : "bg-warm-wrong";

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
          Speed Spelling
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Type as many words as you can in {GAME_DURATION} seconds!
        </p>
      </div>

      {/* Module Selector + High Scores */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={selectedModuleId} onValueChange={(v) => setSelectedModuleId(v ?? "")} disabled={gameStarted}>
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
            disabled={loadingCards || filteredCards.length === 0}
            className="bg-warm-accent text-white hover:bg-warm-accent-dark"
          >
            {loadingCards ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <SpellCheck className="size-4" />
                {gameFinished ? "Play Again" : "Start"}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* High Scores */}
      {(!gameStarted || gameFinished) && (
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-warm-border bg-warm-surface px-4 py-2.5">
            <Trophy className="size-4 text-amber-500" />
            <div className="text-sm">
              <span className="text-warm-text-muted">Personal Best: </span>
              <span className="font-semibold text-warm-text">{personalBest}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-warm-border bg-warm-surface px-4 py-2.5">
            <Zap className="size-4 text-warm-accent" />
            <div className="text-sm">
              <span className="text-warm-text-muted">Best Score: </span>
              <span className="font-semibold text-warm-text">{bestScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* Part Filter Tabs */}
      <Tabs
        value={partFilter}
        onValueChange={(v) => setPartFilter(v as PartFilter)}
        className="mb-6"
      >
        <TabsList variant="line" className="bg-warm-surface-2">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="A">Part A</TabsTrigger>
          <TabsTrigger value="B1">Part B1</TabsTrigger>
          <TabsTrigger value="B2">Part B2</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Game HUD */}
      {gameStarted && (
        <motion.div
          className="mb-6 flex items-center justify-between rounded-xl border border-warm-border bg-warm-surface p-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 text-sm">
            <Timer className={`size-4 ${timeLeft <= 10 ? "text-warm-wrong" : "text-warm-text-muted"}`} />
            <span className={`font-mono text-lg font-semibold ${timeLeft <= 10 ? "text-warm-wrong" : "text-warm-text"}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-warm-text-muted">
            <SpellCheck className="size-4 text-warm-accent" />
            <span>
              Score: <span className="font-semibold text-warm-text">{score}</span>
            </span>
          </div>
          <div className="text-sm text-warm-text-muted">
            {filteredCards.length > 0 ? `${currentIndex + 1} / ${filteredCards.length}` : "—"}
          </div>
        </motion.div>
      )}

      {/* Timer Bar */}
      {gameStarted && (
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-warm-surface-2">
          <motion.div
            className={`h-full ${timerColor} rounded-full`}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>
      )}

      {/* Time's Up Screen */}
      <AnimatePresence>
        {gameFinished && (
          <motion.div
            className="mb-6 rounded-2xl border border-warm-accent/30 bg-warm-surface p-6 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={springSnappy}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...springSnappy, delay: 0.2 }}
            >
              <Timer className="mx-auto mb-3 size-10 text-warm-wrong" />
            </motion.div>
            <h2 className="font-[family-name:var(--font-serif)] text-2xl text-warm-text">
              Time&apos;s Up!
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3"
            >
              <p className="text-3xl font-bold text-warm-accent">{score}</p>
              <p className="text-sm text-warm-text-muted">points</p>
            </motion.div>
            {score >= personalBest && score > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2 text-sm font-medium text-amber-500"
              >
                New Personal Best!
              </motion.p>
            )}
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="text-center">
                <p className="text-xs text-warm-text-muted">Personal Best</p>
                <p className="font-semibold text-warm-text">{Math.max(personalBest, score)}</p>
              </div>
              <div className="h-6 w-px bg-warm-border" />
              <div className="text-center">
                <p className="text-xs text-warm-text-muted">Best Score</p>
                <p className="font-semibold text-warm-text">{Math.max(bestScore, score)}</p>
              </div>
            </div>
            <Button
              onClick={startGame}
              disabled={filteredCards.length === 0}
              className="mt-5 bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              <RotateCcw className="size-4 mr-2" />
              Play Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spelling Card */}
      {gameStarted && !gameFinished && currentCard && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={springSnappy}
          >
            <Card className="border-warm-border bg-warm-surface">
              <CardContent className="flex flex-col items-center gap-5 p-6 md:p-8">
                {/* Definition / Chinese hint */}
                <div className="text-center">
                  <p className="mb-2 text-base text-warm-text">
                    {currentCard.definition}
                  </p>
                  <p className="font-[family-name:var(--font-serif)] text-lg text-warm-accent">
                    {currentCard.chineseMeaning}
                  </p>
                </div>

                {/* Audio button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playAudio(currentCard.word)}
                  className="text-warm-text-muted hover:text-warm-accent"
                  aria-label="Hear pronunciation"
                >
                  <Volume2 className="size-5" />
                </Button>

                {/* Input */}
                <form onSubmit={handleSubmit} className="w-full max-w-xs">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type the word..."
                      disabled={feedback !== null}
                      autoComplete="off"
                      spellCheck={false}
                      className={`h-12 w-full rounded-lg border bg-warm-bg px-4 text-center text-lg outline-none transition-colors ${
                        feedback === "correct"
                          ? "border-warm-correct bg-warm-correct/5"
                          : feedback === "wrong"
                            ? "border-warm-wrong bg-warm-wrong/5"
                            : "border-warm-border focus:border-warm-accent"
                      }`}
                    />
                    {feedback && (
                      <motion.div
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={springSnappy}
                      >
                        {feedback === "correct" ? (
                          <Check className="size-5 text-warm-correct" />
                        ) : (
                          <X className="size-5 text-warm-wrong" />
                        )}
                      </motion.div>
                    )}
                  </div>
                </form>

                {/* Wrong answer feedback */}
                <AnimatePresence>
                  {feedback === "wrong" && (
                    <motion.div
                      className="text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <p className="text-sm text-warm-wrong">
                        The correct answer is:
                      </p>
                      <p className="font-[family-name:var(--font-serif)] text-xl font-medium text-warm-text">
                        {currentCard.word}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Skip Button */}
                {feedback === null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="text-warm-text-subtle hover:text-warm-text-muted"
                  >
                    <SkipForward className="size-4 mr-1.5" />
                    Skip this word
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state */}
      {!gameStarted && !loadingModules && !loadingCards && filteredCards.length === 0 && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-warm-text-subtle">
            {allCards.length === 0
              ? "No cards in this module yet."
              : "No cards match this filter."}
          </p>
        </div>
      )}
    </motion.div>
  );
}
