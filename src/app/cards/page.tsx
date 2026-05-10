"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeCard, normalizeModule, type CardDoc, type ModuleDoc } from "@/lib/guardrails";
import { decrypt } from "@/lib/crypto";
import { getPublishedModules } from "@/lib/firestore-helpers";
import { pageTransition, springSnappy, springBouncy } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  RotateCcw,
  Loader2,
  Layers,
} from "lucide-react";

interface EnrichedCard extends CardDoc {
  id: string;
  moduleId: string;
  definition: string;
  chineseMeaning: string;
  exampleSentence: string;
}

type PartFilter = "all" | "A" | "B1" | "B2";

function docData(d: { data(): Record<string, unknown> }): Record<string, unknown> {
  return d.data() as Record<string, unknown>;
}

export default function CardsPage() {
  const uid = useAuthStore((s) => s.uid);

  const [modules, setModules] = useState<(ModuleDoc & { id: string })[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [allCards, setAllCards] = useState<EnrichedCard[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [partFilter, setPartFilter] = useState<PartFilter>("all");

  // Load modules on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mods = await getPublishedModules();
        if (!cancelled) {
          setModules(mods);
          if (mods.length > 0) {
            setSelectedModuleId(mods[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load modules:", err);
      } finally {
        if (!cancelled) setLoadingModules(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch cards when module changes
  useEffect(() => {
    if (!selectedModuleId) return;
    let cancelled = false;
    (async () => {
      setLoadingCards(true);
      try {
        const cardsRef = collection(db(), "modules", selectedModuleId, "cards");
        const q = query(cardsRef, orderBy("order", "asc"));
        const snap = await getDocs(q);
        const decrypted: EnrichedCard[] = await Promise.all(
          snap.docs.map(async (d) => {
            const raw = normalizeCard(docData(d));
            const [definition, chineseMeaning, exampleSentence] = await Promise.all([
              raw.definitionEnc ? decrypt(raw.definitionEnc) : "",
              raw.chineseMeaningEnc ? decrypt(raw.chineseMeaningEnc) : "",
              raw.exampleSentenceEnc ? decrypt(raw.exampleSentenceEnc) : "",
            ]);
            return {
              ...raw,
              id: d.id,
              moduleId: selectedModuleId,
              definition,
              chineseMeaning,
              exampleSentence,
            };
          })
        );
        if (!cancelled) {
          setAllCards(decrypted);
          setCurrentIndex(0);
          setIsFlipped(false);
        }
      } catch (err) {
        console.error("Failed to load cards:", err);
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedModuleId]);

  // Filtered cards by part
  const filteredCards = useMemo(() => {
    if (partFilter === "all") return allCards;
    return allCards.filter((c) => {
      const tag = (c.partTag || "").toUpperCase();
      if (partFilter === "A") return tag === "A" || tag === "PART A";
      if (partFilter === "B1") return tag === "B1" || tag === "PART B1";
      if (partFilter === "B2") return tag === "B2" || tag === "PART B2";
      return true;
    });
  }, [allCards, partFilter]);

  const currentCard = filteredCards[currentIndex];

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [partFilter]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, filteredCards.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePrev, handleNext, handleFlip]);

  // Save progress when card is viewed
  useEffect(() => {
    if (!uid || !currentCard || !selectedModuleId) return;
    const progressId = `${uid}_${selectedModuleId}`;
    const progressRef = doc(db(), "progress", progressId);
    setDoc(
      progressRef,
      {
        userId: uid,
        moduleId: selectedModuleId,
        cardsStudied: Math.max(currentIndex + 1, 1),
        cardsTotal: filteredCards.length,
        lastStudied: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => {
      console.error("Failed to save progress:", err);
    });
  }, [uid, currentIndex, selectedModuleId, filteredCards.length, currentCard]);

  // TTS playback
  const playAudio = useCallback((text: string) => {
    if (currentCard?.audioUrl) {
      const audio = new Audio(currentCard.audioUrl);
      audio.play().catch(() => {
        // Fallback to TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      });
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }, [currentCard]);

  // Loading state
  if (loadingModules) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-3"
          {...pageTransition}
        >
          <Loader2 className="size-8 animate-spin text-warm-accent" />
          <p className="text-sm text-warm-text-muted">Loading modules...</p>
        </motion.div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          {...pageTransition}
        >
          <Layers className="size-12 text-warm-text-subtle" />
          <p className="text-warm-text-muted">No published modules available yet.</p>
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
          Flashcards
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Tap a card to reveal its definition
        </p>
      </div>

      {/* Module Selector */}
      <div className="mb-4">
        <Select value={selectedModuleId} onValueChange={(v) => setSelectedModuleId(v ?? "")}>
          <SelectTrigger className="w-full border-warm-border bg-warm-surface md:w-72">
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
      </div>

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

      {/* Card Counter */}
      {filteredCards.length > 0 && (
        <div className="mb-4 text-center text-sm text-warm-text-muted">
          {currentIndex + 1} / {filteredCards.length}
        </div>
      )}

      {/* Flashcard Area */}
      {loadingCards ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-warm-accent" />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-warm-text-muted">
            {allCards.length === 0
              ? "No cards in this module yet."
              : "No cards match this filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* 3D Flip Card */}
          <div
            className="relative h-[320px] w-full cursor-pointer perspective-[1200px] md:h-[360px]"
            onClick={handleFlip}
          >
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={springBouncy}
            >
              {/* Front Face */}
              <div className="absolute inset-0 rounded-2xl border border-warm-border bg-warm-surface p-6 shadow-sm flex flex-col items-center justify-center backface-hidden md:p-8">
                <p className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text md:text-4xl">
                  {currentCard?.word}
                </p>
                {currentCard?.partTag && (
                  <span className="mt-3 inline-block rounded-full bg-warm-accent/10 px-3 py-0.5 text-xs font-medium text-warm-accent">
                    {currentCard.partTag}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-4 top-4 text-warm-text-muted hover:text-warm-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentCard) playAudio(currentCard.word);
                  }}
                  aria-label="Play pronunciation"
                >
                  <Volume2 className="size-5" />
                </Button>
                <p className="absolute bottom-4 text-xs text-warm-text-subtle">
                  Tap to flip
                </p>
              </div>

              {/* Back Face */}
              <div className="absolute inset-0 rounded-2xl border border-warm-accent/30 bg-warm-surface-2 p-6 shadow-sm flex flex-col items-center justify-center backface-hidden [transform:rotateY(180deg)] md:p-8">
                <p className="mb-3 text-base font-medium text-warm-text">
                  {currentCard?.definition}
                </p>
                <p className="mb-3 font-[family-name:var(--font-serif)] text-xl text-warm-accent">
                  {currentCard?.chineseMeaning}
                </p>
                {currentCard?.exampleSentence && (
                  <p className="mt-2 text-sm italic text-warm-text-muted">
                    &ldquo;{currentCard.exampleSentence}&rdquo;
                  </p>
                )}
                <p className="absolute bottom-4 text-xs text-warm-text-subtle">
                  Tap to flip back
                </p>
              </div>
            </motion.div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="border-warm-border text-warm-text-muted hover:text-warm-text"
              aria-label="Previous card"
            >
              <ChevronLeft className="size-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className="text-warm-text-subtle hover:text-warm-accent"
              aria-label="Reset to first card"
            >
              <RotateCcw className="size-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex >= filteredCards.length - 1}
              className="border-warm-border text-warm-text-muted hover:text-warm-text"
              aria-label="Next card"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-warm-surface-2">
            <motion.div
              className="h-full rounded-full bg-warm-accent"
              initial={false}
              animate={{
                width: `${((currentIndex + 1) / filteredCards.length) * 100}%`,
              }}
              transition={springSnappy}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
