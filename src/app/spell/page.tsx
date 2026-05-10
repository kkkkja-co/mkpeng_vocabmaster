"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, orderBy, getDocs, query, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeCard, type CardDoc } from "@/lib/guardrails";
import { decrypt } from "@/lib/crypto";
import { getPublishedModules } from "@/lib/firestore-helpers";
import { pageTransition, springSnappy, slideUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SpellCheck, Loader2, Check, X, Volume2, RotateCcw } from "lucide-react";

interface SpellItem {
  id: string;
  word: string;
  definition: string;
  chineseMeaning: string;
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

export default function SpellPage() {
  const uid = useAuthStore((s) => s.uid);

  const [modules, setModules] = useState<ModuleDocWithId[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);

  const [cards, setCards] = useState<SpellItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentCard = cards[currentIndex];

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

  // Start game
  const startGame = useCallback(async () => {
    if (!selectedModuleId) return;
    setLoadingCards(true);
    setGameStarted(false);
    setGameFinished(false);
    setCorrectCount(0);
    setWrongCount(0);
    setCurrentIndex(0);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);

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
          return { id: d.id, word: raw.word, definition, chineseMeaning };
        })
      );

      setCards(shuffleArray(items));
      setGameStarted(true);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoadingCards(false);
    }
  }, [selectedModuleId]);

  // Save progress
  useEffect(() => {
    if (!uid || !selectedModuleId || !gameStarted) return;
    const totalStudied = correctCount + wrongCount;
    if (totalStudied === 0) return;

    const progressId = `${uid}_${selectedModuleId}`;
    const progressRef = doc(db(), "progress", progressId);
    setDoc(
      progressRef,
      {
        userId: uid,
        moduleId: selectedModuleId,
        cardsStudied: totalStudied,
        cardsTotal: cards.length,
        correctCount,
        wrongCount,
        score: cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0,
        lastStudied: serverTimestamp(),
      },
      { merge: true }
    ).catch((err: unknown) => console.error("Failed to save progress:", err));
  }, [uid, selectedModuleId, correctCount, wrongCount, cards.length, gameStarted]);

  // Auto-focus input
  useEffect(() => {
    if (gameStarted && !gameFinished && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, gameStarted, gameFinished]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback !== null || !currentCard) return;

    const isCorrect = input.trim().toLowerCase() === currentCard.word.toLowerCase();
    setFeedback(isCorrect ? "correct" : "wrong");
    setShowAnswer(!isCorrect);

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else {
      setWrongCount((w) => w + 1);
    }

    // Auto-advance after delay
    setTimeout(() => {
      handleNext();
    }, isCorrect ? 800 : 1800);
  };

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setInput("");
      setFeedback(null);
      setShowAnswer(false);
    } else {
      setGameFinished(true);
    }
  }, [currentIndex, cards.length]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const progressPercent = cards.length > 0 ? ((currentIndex + (feedback ? 1 : 0)) / cards.length) * 100 : 0;

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
          Spelling Practice
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Type the correct word for each definition
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
                <SpellCheck className="size-4" />
                {gameFinished ? "Try Again" : "Start Practice"}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* Progress Bar */}
      {gameStarted && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-warm-text-muted">
            <span>
              {currentIndex + 1} / {cards.length}
            </span>
            <span>
              <span className="text-warm-correct">{correctCount} correct</span>
              {" / "}
              <span className="text-warm-wrong">{wrongCount} wrong</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-warm-surface-2">
            <motion.div
              className="h-full rounded-full bg-warm-accent"
              animate={{ width: `${progressPercent}%` }}
              transition={springSnappy}
            />
          </div>
        </div>
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
            <SpellCheck className="mx-auto mb-2 size-10 text-warm-accent" />
            <h2 className="font-[family-name:var(--font-serif)] text-xl text-warm-text">
              Practice Complete!
            </h2>
            <p className="mt-2 text-sm text-warm-text-muted">
              You got{" "}
              <span className="font-medium text-warm-correct">{correctCount}</span> correct
              and{" "}
              <span className="font-medium text-warm-wrong">{wrongCount}</span> wrong
            </p>
            <p className="mt-1 text-lg font-medium text-warm-accent">
              {cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0}% accuracy
            </p>
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
              <CardContent className="flex flex-col items-center gap-6 p-6 md:p-8">
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
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type the word..."
                      disabled={feedback !== null}
                      autoComplete="off"
                      spellCheck={false}
                      className={`h-12 text-center text-lg ${
                        feedback === "correct"
                          ? "border-warm-correct bg-warm-correct/5"
                          : feedback === "wrong"
                            ? "border-warm-wrong bg-warm-wrong/5"
                            : "border-warm-border bg-warm-bg"
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
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state */}
      {!gameStarted && !loadingModules && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-warm-text-subtle">Select a module to begin practicing</p>
        </div>
      )}
    </motion.div>
  );
}
