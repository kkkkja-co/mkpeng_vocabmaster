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
  type CardDoc,
} from "@/lib/guardrails";
import { Button } from "@/components/ui/button";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { Check, X, Loader2 } from "lucide-react";
import { springSnappy, staggerContainer, staggerItem } from "@/lib/animations";

interface BattleArenaProps {
  battleId: string;
  battle: BattleDoc;
  players: Record<string, PlayerDoc>;
  currentUid: string;
}

interface QuizCard {
  word: string;
  definition: string;
  chineseMeaning: string;
  exampleSentence: string;
}

interface Option {
  text: string;
  isCorrect: boolean;
}

export function BattleArena({
  battleId,
  battle,
  players,
  currentUid,
}: BattleArenaProps) {
  const [quizCards, setQuizCards] = useState<QuizCard[]>([]);
  const [currentOptions, setCurrentOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(battle.timePerCard);
  const [processingAnswer, setProcessingAnswer] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAdvancedRef = useRef(false);

  const currentPlayer = players[currentUid];
  const cardIndex = battle.currentCardIndex;
  const totalCards = battle.totalCards;
  const allAnswered = Object.values(players).every(
    (p) => p.status === "answered" || p.answeredCards.includes(String(cardIndex))
  );

  // Load all cards for the module
  useEffect(() => {
    async function loadCards() {
      try {
        const cardsSnap = await getDocs(
          collection(db(), "modules", battle.moduleId, "cards")
        );
        const rawCards = cardsSnap.docs.map((d) =>
          normalizeCard(d.data() as Record<string, unknown>)
        );

        // Sort by order and decrypt
        rawCards.sort((a, b) => a.order - b.order);

        const decrypted: QuizCard[] = await Promise.all(
          rawCards.slice(0, battle.totalCards).map(async (c) => ({
            word: c.word,
            definition: await decrypt(c.definitionEnc),
            chineseMeaning: await decrypt(c.chineseMeaningEnc),
            exampleSentence: await decrypt(c.exampleSentenceEnc),
          }))
        );

        setQuizCards(decrypted);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load cards:", err);
        setLoading(false);
      }
    }
    loadCards();
  }, [battle.moduleId, battle.totalCards]);

  // Build options when card changes
  useEffect(() => {
    if (quizCards.length === 0 || cardIndex >= quizCards.length) return;

    const current = quizCards[cardIndex];
    setAnswered(false);
    setSelectedAnswer(null);
    setWasCorrect(null);
    setTimeLeft(battle.timePerCard);
    hasAdvancedRef.current = false;
    startTimeRef.current = Date.now();

    // Check if already answered this card
    if (currentPlayer?.answeredCards.includes(String(cardIndex))) {
      setAnswered(true);
    }

    // Build options: 1 correct + 3 wrong
    const otherCards = quizCards.filter((_, i) => i !== cardIndex);
    const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
    const wrongOptions = shuffledOthers.slice(0, 3).map((c) => ({
      text: c.definition,
      isCorrect: false,
    }));

    const correctOption = {
      text: current.definition,
      isCorrect: true,
    };

    const allOptions = [correctOption, ...wrongOptions].sort(
      () => Math.random() - 0.5
    );
    setCurrentOptions(allOptions);
  }, [quizCards, cardIndex, battle.timePerCard, currentPlayer]);

  // Timer
  useEffect(() => {
    if (answered || loading) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Auto-submit as timeout
          handleAnswer(null);
          return 0;
        }
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [answered, loading, cardIndex]);

  // Auto-advance when all players answered or timer expired
  useEffect(() => {
    if (
      answered &&
      (allAnswered || timeLeft <= 0) &&
      !hasAdvancedRef.current &&
      isHost
    ) {
      hasAdvancedRef.current = true;

      const advanceTimeout = setTimeout(async () => {
        try {
          if (cardIndex + 1 >= totalCards) {
            await updateDoc(doc(db(), "battles", battleId), {
              status: "finished",
            });
          } else {
            await updateDoc(doc(db(), "battles", battleId), {
              currentCardIndex: cardIndex + 1,
              currentCardStart: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to advance:", err);
          hasAdvancedRef.current = false;
        }
      }, 2000);

      return () => clearTimeout(advanceTimeout);
    }
  }, [answered, allAnswered, timeLeft, cardIndex, totalCards, battleId]);

  const isHost = battle.hostId === currentUid;

  const handleAnswer = useCallback(
    async (selectedText: string | null) => {
      if (answered || processingAnswer) return;
      if (!quizCards[cardIndex]) return;

      setProcessingAnswer(true);
      setAnswered(true);
      if (timerRef.current) clearInterval(timerRef.current);

      const responseMs = Date.now() - startTimeRef.current;
      const currentCard = quizCards[cardIndex];
      const correct = selectedText === currentCard.definition;
      const isTimeout = selectedText === null;

      setSelectedAnswer(selectedText);
      setWasCorrect(correct);

      // Calculate score
      let scoreGain = 0;
      if (correct) {
        scoreGain = 100;
        if (responseMs < 3000) scoreGain += 50;
        else if (responseMs < 7000) scoreGain += 25;

        const currentStreak = currentPlayer?.streak ?? 0;
        if (currentStreak >= 2) {
          scoreGain += 25;
        }
      }

      try {
        await runTransaction(db(), async (transaction) => {
          const playerRef = doc(
            db(),
            "battles",
            battleId,
            "players",
            currentUid
          );
          const playerSnap = await transaction.get(playerRef);
          if (!playerSnap.exists()) return;

          const playerData = playerSnap.data();
          const prevScore = (playerData.score as number) ?? 0;
          const prevStreak = (playerData.streak as number) ?? 0;
          const prevAnswered = (playerData.answeredCards as string[]) ?? [];

          transaction.update(playerRef, {
            score: prevScore + scoreGain,
            streak: correct ? prevStreak + 1 : 0,
            answeredCards: [...prevAnswered, String(cardIndex)],
            status: "answered",
            lastAnswerTime: serverTimestamp(),
          });

          // Write answer doc
          const answerRef = doc(
            collection(db(), "battles", battleId, "answers")
          );
          transaction.set(answerRef, {
            uid: currentUid,
            cardIndex,
            answeredAt: serverTimestamp(),
            correct,
            responseMs,
          });
        });
      } catch (err) {
        console.error("Failed to submit answer:", err);
      } finally {
        setProcessingAnswer(false);
      }
    },
    [
      answered,
      processingAnswer,
      quizCards,
      cardIndex,
      currentPlayer,
      battleId,
      currentUid,
    ]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-warm-battle" />
      </div>
    );
  }

  if (cardIndex >= quizCards.length) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-warm-text-muted">Battle complete!</p>
      </div>
    );
  }

  const currentCard = quizCards[cardIndex];
  const timerPercent = (timeLeft / battle.timePerCard) * 100;
  const timerColor =
    timerPercent > 50
      ? "bg-warm-battle"
      : timerPercent > 25
        ? "bg-amber-500"
        : "bg-warm-wrong";

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-warm-border bg-[#faf7f2]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-warm-text">
            <span className="text-warm-battle font-[family-name:var(--font-mono)]">
              {cardIndex + 1}
            </span>
            <span className="text-warm-text-subtle"> / {totalCards}</span>
          </div>
          <div className="text-sm font-medium text-warm-text-muted">
            {currentPlayer?.score ?? 0} pts
          </div>
        </div>
        {/* Timer bar */}
        <div className="h-1 w-full bg-warm-border">
          <motion.div
            className={`h-full ${timerColor} rounded-full`}
            initial={{ width: "100%" }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[1fr_220px]">
          {/* Main card area */}
          <div>
            {/* Word card */}
            <motion.div
              key={cardIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springSnappy}
              className="mb-6 rounded-2xl border border-warm-border bg-[#faf7f2] p-8 text-center shadow-sm"
            >
              <p className="font-[family-name:var(--font-serif)] text-4xl font-normal text-warm-text">
                {currentCard.word}
              </p>
              <p className="mt-2 text-sm text-warm-text-subtle">
                Choose the correct definition
              </p>
            </motion.div>

            {/* Options */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-3"
            >
              {currentOptions.map((option, i) => {
                const isSelected = selectedAnswer === option.text;
                const showResult = answered;

                let borderColor = "border-warm-border";
                let bgColor = "bg-[#faf7f2]";
                let textColor = "text-warm-text";

                if (showResult && option.isCorrect) {
                  borderColor = "border-warm-correct";
                  bgColor = "bg-warm-correct/10";
                  textColor = "text-green-700";
                } else if (showResult && isSelected && !option.isCorrect) {
                  borderColor = "border-warm-wrong";
                  bgColor = "bg-warm-wrong/10";
                  textColor = "text-warm-wrong";
                }

                return (
                  <motion.button
                    key={`${cardIndex}-${i}`}
                    variants={staggerItem}
                    onClick={() => handleAnswer(option.text)}
                    disabled={answered || processingAnswer}
                    className={`w-full rounded-xl border-2 ${borderColor} ${bgColor} p-4 text-left transition-all hover:shadow-sm disabled:cursor-default ${textColor}`}
                    whileHover={!answered ? { scale: 1.01 } : undefined}
                    whileTap={!answered ? { scale: 0.99 } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-warm-border bg-warm-bg text-xs font-medium text-warm-text-muted">
                        {showResult && option.isCorrect ? (
                          <Check className="size-3.5 text-warm-correct" />
                        ) : showResult && isSelected ? (
                          <X className="size-3.5 text-warm-wrong" />
                        ) : (
                          String.fromCharCode(65 + i)
                        )}
                      </span>
                      <span className="text-sm leading-relaxed">
                        {option.text}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Feedback */}
            <AnimatePresence>
              {answered && wasCorrect !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-4 rounded-xl p-4 text-center text-sm font-medium ${
                    wasCorrect
                      ? "bg-warm-correct/10 text-green-700"
                      : "bg-warm-wrong/10 text-warm-wrong"
                  }`}
                >
                  {wasCorrect ? "Correct!" : selectedAnswer === null ? "Time's up!" : "Wrong answer"}
                  {wasCorrect && (
                    <span className="ml-2 text-xs opacity-70">
                      +{(() => {
                        let pts = 100;
                        const responseMs = Date.now() - startTimeRef.current;
                        if (responseMs < 3000) pts += 50;
                        else if (responseMs < 7000) pts += 25;
                        const currentStreak = currentPlayer?.streak ?? 0;
                        if (currentStreak >= 2) pts += 25;
                        return pts;
                      })()} pts
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
