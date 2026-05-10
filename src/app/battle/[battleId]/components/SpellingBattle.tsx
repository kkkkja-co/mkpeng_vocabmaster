"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decrypt } from "@/lib/crypto";
import {
  normalizeCard,
  type BattleDoc,
  type PlayerDoc,
} from "@/lib/guardrails";
import { Button } from "@/components/ui/button";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { Volume2, Check, X, SkipForward, Timer } from "lucide-react";
import { springSnappy } from "@/lib/animations";

interface SpellingBattleProps {
  battleId: string;
  battle: BattleDoc;
  players: Record<string, PlayerDoc>;
  currentUid: string;
}

interface SpellCard {
  word: string;
  definition: string;
  chineseMeaning: string;
  exampleSentence: string;
}

const GAME_DURATION = 60;
const POINTS_PER_WORD = 10;

export function SpellingBattle({
  battleId,
  battle,
  players,
  currentUid,
}: SpellingBattleProps) {
  const [cards, setCards] = useState<SpellCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [loading, setLoading] = useState(true);
  const [gameFinished, setGameFinished] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);

  const isHost = battle.hostId === currentUid;
  const hasAdvancedRef = useRef(false);

  const currentCard = cards[currentIndex];

  // Load cards
  useEffect(() => {
    async function loadCards() {
      try {
        const cardsSnap = await getDocs(
          collection(db(), "modules", battle.moduleId, "cards")
        );
        const rawCards = cardsSnap.docs.map((d) =>
          normalizeCard(d.data() as Record<string, unknown>)
        );
        rawCards.sort((a, b) => a.order - b.order);

        const decrypted: SpellCard[] = await Promise.all(
          rawCards.slice(0, battle.totalCards).map(async (c) => ({
            word: c.word,
            definition: await decrypt(c.definitionEnc),
            chineseMeaning: await decrypt(c.chineseMeaningEnc),
            exampleSentence: await decrypt(c.exampleSentenceEnc),
          }))
        );

        setCards(decrypted);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load cards:", err);
        setLoading(false);
      }
    }
    loadCards();
  }, [battle.moduleId, battle.totalCards]);

  // Timer
  useEffect(() => {
    if (!loading || gameFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, gameFinished]);

  // Auto-focus input
  useEffect(() => {
    if (!loading && !gameFinished && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, loading, gameFinished, feedback]);

  // Submit final score when game finishes
  useEffect(() => {
    if (!gameFinished) return;

    // Wait a moment then submit score
    const timeout = setTimeout(async () => {
      try {
        await runTransaction(db(), async (transaction) => {
          const playerRef = doc(db(), "battles", battleId, "players", currentUid);
          const playerSnap = await transaction.get(playerRef);
          if (!playerSnap.exists()) return;

          transaction.update(playerRef, {
            score: scoreRef.current,
            status: "answered",
            lastAnswerTime: serverTimestamp(),
          });
        });

        // If host, check if both players finished and advance
        if (isHost && !hasAdvancedRef.current) {
          hasAdvancedRef.current = true;
          setTimeout(async () => {
            try {
              await updateDoc(doc(db(), "battles", battleId), {
                status: "finished",
              });
            } catch (err) {
              console.error("Failed to finish battle:", err);
            }
          }, 2000);
        }
      } catch (err) {
        console.error("Failed to submit score:", err);
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [gameFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setInput("");
      setFeedback(null);
    } else {
      setCurrentIndex(0);
      setInput("");
      setFeedback(null);
    }
  }, [currentIndex, cards.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback !== null || !currentCard || !gameStarted) return;

    const isCorrect = input.trim().toLowerCase() === currentCard.word.toLowerCase();
    setFeedback(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      const newScore = scoreRef.current + POINTS_PER_WORD;
      scoreRef.current = newScore;
      setScore(newScore);
    }

    feedbackTimeoutRef.current = setTimeout(() => {
      handleNext();
    }, isCorrect ? 600 : 1200);
  };

  const handleSkip = () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    handleNext();
  };

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const gameStarted = loading === false && !gameFinished;
  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor =
    timerPercent > 50
      ? "bg-warm-battle"
      : timerPercent > 25
        ? "bg-amber-500"
        : "bg-warm-wrong";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-warm-battle/20 border-t-warm-battle" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-warm-border bg-[#faf7f2]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-warm-text">
            <span className="text-warm-battle font-[family-name:var(--font-mono)]">
              {currentIndex + 1}
            </span>
            <span className="text-warm-text-subtle"> / {cards.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className={`size-4 ${timeLeft <= 10 ? "text-warm-wrong" : "text-warm-text-muted"}`} />
            <span className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${timeLeft <= 10 ? "text-warm-wrong" : "text-warm-text"}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="text-sm font-medium text-warm-text-muted">
            {score} pts
          </div>
        </div>
        {/* Timer bar */}
        <div className="h-1 w-full bg-warm-border">
          <motion.div
            className={`h-full ${timerColor} rounded-full`}
            initial={{ width: "100%" }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[1fr_220px]">
          {/* Main area */}
          <div>
            {gameFinished ? (
              <motion.div
                className="rounded-2xl border border-warm-accent/30 bg-[#faf7f2] p-8 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springSnappy}
              >
                <Timer className="mx-auto mb-3 size-10 text-warm-wrong" />
                <h2 className="font-[family-name:var(--font-serif)] text-2xl text-warm-text">
                  Time&apos;s Up!
                </h2>
                <p className="mt-2 text-3xl font-bold text-warm-battle">{score}</p>
                <p className="text-sm text-warm-text-muted">points</p>
                <p className="mt-3 text-sm text-warm-text-muted">Waiting for results...</p>
              </motion.div>
            ) : currentCard ? (
              <>
                {/* Definition card */}
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={springSnappy}
                  className="mb-6 rounded-2xl border border-warm-border bg-[#faf7f2] p-8 text-center shadow-sm"
                >
                  <p className="text-base text-warm-text">{currentCard.definition}</p>
                  <p className="mt-2 font-[family-name:var(--font-serif)] text-lg text-warm-accent">
                    {currentCard.chineseMeaning}
                  </p>
                  <p className="mt-1 text-xs text-warm-text-subtle">Type the word</p>
                </motion.div>

                {/* Audio */}
                <div className="mb-4 flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => playAudio(currentCard.word)}
                    className="text-warm-text-muted hover:text-warm-accent"
                  >
                    <Volume2 className="size-5" />
                  </Button>
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="mx-auto max-w-xs">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type the word..."
                      disabled={feedback !== null}
                      autoComplete="off"
                      spellCheck={false}
                      className={`h-12 w-full rounded-lg border bg-white px-4 text-center text-lg outline-none transition-colors ${
                        feedback === "correct"
                          ? "border-warm-correct bg-warm-correct/5"
                          : feedback === "wrong"
                            ? "border-warm-wrong bg-warm-wrong/5"
                            : "border-warm-border focus:border-warm-battle"
                      }`}
                    />
                    {feedback && (
                      <motion.div
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
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

                {/* Feedback */}
                <AnimatePresence>
                  {feedback === "wrong" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-center"
                    >
                      <p className="text-sm text-warm-wrong">Correct answer:</p>
                      <p className="font-[family-name:var(--font-serif)] text-xl font-medium text-warm-text">
                        {currentCard.word}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Skip */}
                {feedback === null && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      className="text-warm-text-subtle hover:text-warm-text-muted"
                    >
                      <SkipForward className="size-4 mr-1.5" />
                      Skip this word
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Leaderboard sidebar */}
          <div className="hidden md:block">
            <LiveLeaderboard players={players} currentUid={currentUid} />
          </div>
        </div>
      </div>
    </div>
  );
}
