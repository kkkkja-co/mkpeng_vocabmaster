"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, orderBy, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeCard, type CardDoc } from "@/lib/guardrails";
import { decrypt } from "@/lib/crypto";
import { getPublishedModules } from "@/lib/firestore-helpers";
import { pageTransition, staggerContainer, staggerItem, springSnappy } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Volume2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface ReadingCard {
  id: string;
  word: string;
  definition: string;
  chineseMeaning: string;
  exampleSentence: string;
  partTag: string;
  order: number;
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

export default function ReadingPage() {
  const [modules, setModules] = useState<ModuleDocWithId[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);

  const [cards, setCards] = useState<ReadingCard[]>([]);
  const [showChinese, setShowChinese] = useState(false);

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

  // Fetch cards
  useEffect(() => {
    if (!selectedModuleId) return;
    let cancelled = false;

    (async () => {
      setLoadingCards(true);
      try {
        const cardsRef = collection(db(), "modules", selectedModuleId, "cards");
        const q = query(cardsRef, orderBy("order", "asc"));
        const snap = await getDocs(q);

        const items: ReadingCard[] = await Promise.all(
          snap.docs.map(async (d) => {
            const raw = normalizeCard(docData(d));
            const [definition, chineseMeaning, exampleSentence] = await Promise.all([
              raw.definitionEnc ? decrypt(raw.definitionEnc) : "",
              raw.chineseMeaningEnc ? decrypt(raw.chineseMeaningEnc) : "",
              raw.exampleSentenceEnc ? decrypt(raw.exampleSentenceEnc) : "",
            ]);
            return {
              id: d.id,
              word: raw.word,
              definition,
              chineseMeaning,
              exampleSentence,
              partTag: raw.partTag,
              order: raw.order,
            };
          })
        );

        if (!cancelled) setCards(items);
      } catch (err) {
        console.error("Failed to load cards:", err);
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedModuleId]);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  // Group cards by partTag
  const grouped = cards.reduce<Record<string, ReadingCard[]>>((acc, card) => {
    const key = card.partTag || "Ungrouped";
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});

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
      className="mx-auto max-w-4xl px-4 py-6 md:py-10"
      {...pageTransition}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-normal text-warm-text md:text-3xl">
          Reading Support
        </h1>
        <p className="mt-1 text-sm text-warm-text-muted">
          Browse vocabulary words with definitions and example sentences
        </p>
      </div>

      {/* Module Selector + Toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedModuleId} onValueChange={(v) => setSelectedModuleId(v ?? "")}>
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowChinese((prev) => !prev)}
          className="border-warm-border text-warm-text-muted hover:text-warm-text"
        >
          {showChinese ? (
            <>
              <EyeOff className="size-4" /> Hide Chinese
            </>
          ) : (
            <>
              <Eye className="size-4" /> Show Chinese
            </>
          )}
        </Button>
      </div>

      {/* Loading */}
      {loadingCards ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-warm-accent" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-warm-text-subtle">
            {modules.length === 0
              ? "No published modules available yet."
              : "No cards in this module."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([part, partCards]) => (
            <motion.div
              key={part}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {/* Part Group Header */}
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-warm-text-muted">
                <BookOpen className="size-4" />
                {part}
                <Badge variant="secondary" className="text-[10px]">
                  {partCards.length} words
                </Badge>
              </h2>

              {/* Cards List */}
              <div className="space-y-2">
                {partCards.map((card) => (
                  <motion.div key={card.id} variants={staggerItem}>
                    <Card className="border-warm-border bg-warm-surface transition-colors hover:border-warm-accent/30">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Left: Word + Definition */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-[family-name:var(--font-serif)] text-lg font-normal text-warm-text">
                              {card.word}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => playAudio(card.word)}
                              className="text-warm-text-subtle hover:text-warm-accent"
                              aria-label={`Hear ${card.word} pronunciation`}
                            >
                              <Volume2 className="size-3.5" />
                            </Button>
                          </div>
                          <p className="mt-1 text-sm text-warm-text-muted">
                            {card.definition}
                          </p>
                          <AnimatePresence>
                            {showChinese && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="font-[family-name:var(--font-serif)] text-sm text-warm-accent"
                              >
                                {card.chineseMeaning}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          {card.exampleSentence && (
                            <p className="mt-1 text-xs italic text-warm-text-subtle">
                              &ldquo;{card.exampleSentence}&rdquo;
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
