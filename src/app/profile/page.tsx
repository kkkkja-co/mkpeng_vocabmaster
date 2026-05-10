"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { db, auth as getAuth } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeProgress, type ProgressDoc } from "@/lib/guardrails";
import { getUserCollections, getMasteryLevel } from "@/lib/collections";
import { pageTransition, staggerContainer, staggerItem, springSnappy } from "@/lib/animations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  GraduationCap,
  BookOpen,
  CheckCircle,
  XCircle,
  TrendingUp,
  Loader2,
  CalendarDays,
  Mail,
  Lock,
  Pencil,
  X,
  Volume2,
} from "lucide-react";

interface ProgressWithModule extends ProgressDoc {
  id: string;
  moduleTitle: string;
}

interface WordItem {
  word: string;
  definition: string;
  exampleSentence: string;
  collectedAt: number;
  moduleId: string;
}

function docData(d: { data(): Record<string, unknown> }): Record<string, unknown> {
  return d.data() as Record<string, unknown>;
}

function formatDate(ts: { toDate(): Date } | null): string {
  if (!ts) return "N/A";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

export default function ProfilePage() {
  const { uid, name, className, classNum, loading: authLoading } = useAuthStore();

  const [progress, setProgress] = useState<ProgressWithModule[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Password reset state
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Word collection state
  const [words, setWords] = useState<WordItem[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [loadingWords, setLoadingWords] = useState(true);
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);

  const mastery = getMasteryLevel(totalWords);

  const playAudio = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  // Load progress
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      try {
        const q = query(
          collection(db(), "progress"),
          where("userId", "==", uid),
          orderBy("lastStudied", "desc")
        );
        const snap = await getDocs(q);

        const items: ProgressWithModule[] = await Promise.all(
          snap.docs.map(async (d) => {
            const data = normalizeProgress(docData(d));
            let moduleTitle = "Unknown Module";
            try {
              const { doc: docFn, getDoc } = await import("firebase/firestore");
              const modSnap = await getDoc(docFn(db(), "modules", data.moduleId));
              if (modSnap.exists()) {
                moduleTitle = (modSnap.data().title as string) ?? "Unknown Module";
              }
            } catch {
              // ignore
            }
            return { ...data, id: d.id, moduleTitle };
          })
        );

        if (!cancelled) setProgress(items);
      } catch (err) {
        console.error("Failed to load progress:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  // Load word collection
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingWords(true);
        const collection = await getUserCollections(uid);
        if (!cancelled) {
          setTotalWords(collection.totalCount);
          setWords(collection.words);
        }
      } catch (err) {
        console.error("Failed to load word collection:", err);
      } finally {
        if (!cancelled) setLoadingWords(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

  // Aggregate stats
  const totalCardsStudied = progress.reduce((sum, p) => sum + p.cardsStudied, 0);
  const totalCorrect = progress.reduce((sum, p) => sum + p.correctCount, 0);
  const totalWrong = progress.reduce((sum, p) => sum + p.wrongCount, 0);
  const averageScore =
    progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
      : 0;

  const handleSaveName = async () => {
    if (!newName.trim() || !uid) return;
    setSavingName(true);
    try {
      // Update Firestore
      const userRef = doc(db(), "users", uid);
      const { encrypt } = await import("@/lib/crypto");
      await updateDoc(userRef, {
        nameEnc: await encrypt(newName.trim()),
        lastActive: serverTimestamp(),
      });

      // Update Firebase Auth
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      if (user) {
        await updateProfile(user, { displayName: newName.trim() });
      }

      setIsEditingName(false);
      window.location.reload();
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleResetPassword = async () => {
    const authInstance = getAuth();
    const user = authInstance.currentUser;
    if (!user?.email) return;
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(authInstance, user.email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err) {
      console.error("Failed to send reset email:", err);
    } finally {
      setSendingReset(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div className="flex flex-col items-center gap-3" {...pageTransition}>
          <Loader2 className="size-8 animate-spin text-warm-accent" />
          <p className="text-sm text-warm-text-muted">Loading profile...</p>
        </motion.div>
      </div>
    );
  }

  const email = typeof window !== "undefined" ? getAuth().currentUser?.email ?? "" : "";

  return (
    <motion.div
      className="mx-auto max-w-3xl px-4 py-6 md:py-10"
      {...pageTransition}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-normal text-warm-text md:text-3xl">
          My Profile
        </h1>
      </div>

      {/* Student Info Card */}
      <Card className="mb-6 border-warm-border bg-warm-surface">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-warm-accent/10">
              <User className="size-7 text-warm-accent" />
            </div>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new name"
                    className="h-9 border-warm-border bg-warm-bg"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={savingName || !newName.trim()}
                    className="bg-warm-accent text-white hover:bg-warm-accent-dark"
                  >
                    {savingName ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingName(false)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-warm-text">{name || "Student"}</h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setNewName(name || ""); setIsEditingName(true); }}
                    className="text-warm-text-subtle hover:text-warm-accent"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-warm-text-muted">
                <GraduationCap className="size-4" />
                <span>{className || "N/A"} &middot; #{classNum || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Email + Reset */}
          <div className="mt-4 flex flex-col gap-2 border-t border-warm-border pt-4">
            <div className="flex items-center gap-2 text-sm text-warm-text-muted">
              <Mail className="size-4" />
              <span>{email}</span>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={sendingReset}
                className="border-warm-border text-warm-text-muted hover:text-warm-text"
              >
                <Lock className="size-3.5 mr-1.5" />
                {sendingReset ? "Sending..." : resetSent ? "Email Sent!" : "Reset Password"}
              </Button>
              {resetSent && (
                <p className="mt-1 text-xs text-warm-correct">Password reset email sent to {email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Mastery */}
      <Card className="mb-6 border-warm-border bg-warm-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warm-text">
            <TrendingUp className="size-5 text-warm-accent" />
            Personal Mastery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">{mastery.icon}</span>
            <div>
              <p className="font-medium text-warm-text">Level {mastery.level}: {mastery.name}</p>
              <p className="text-sm text-warm-text-muted">{totalWords} words collected</p>
            </div>
          </div>

          {/* Progress bar to next level */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-warm-text-muted">
              <span>Progress to next level</span>
              <span>{mastery.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-warm-surface-2">
              <motion.div
                className="h-full rounded-full bg-warm-accent"
                initial={{ width: 0 }}
                animate={{ width: `${mastery.progress}%` }}
                transition={springSnappy}
              />
            </div>
          </div>

          {/* Level checkpoints */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={`flex-1 h-1 rounded-full ${
                  lvl <= mastery.level ? "bg-warm-accent" : "bg-warm-surface-2"
                }`}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-warm-text-subtle">
            <span>10</span>
            <span>30</span>
            <span>60</span>
            <span>100</span>
            <span>150</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <BookOpen className="size-5 text-warm-accent" />
            <span className="text-2xl font-medium text-warm-text">{totalCardsStudied}</span>
            <span className="text-xs text-warm-text-muted">Cards Studied</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <CheckCircle className="size-5 text-warm-correct" />
            <span className="text-2xl font-medium text-warm-text">{totalCorrect}</span>
            <span className="text-xs text-warm-text-muted">Correct</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <XCircle className="size-5 text-warm-wrong" />
            <span className="text-2xl font-medium text-warm-text">{totalWrong}</span>
            <span className="text-xs text-warm-text-muted">Wrong</span>
          </CardContent>
        </Card>

        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <TrendingUp className="size-5 text-warm-accent" />
            <span className="text-2xl font-medium text-warm-text">{averageScore}%</span>
            <span className="text-xs text-warm-text-muted">Avg Score</span>
          </CardContent>
        </Card>
      </div>

      {/* Word Collection */}
      <h2 className="mb-3 text-lg font-medium text-warm-text">Word Collection</h2>
      {loadingWords ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex justify-center p-6">
            <Loader2 className="size-5 animate-spin text-warm-accent" />
          </CardContent>
        </Card>
      ) : words.length === 0 ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <BookOpen className="size-10 text-warm-text-subtle" />
            <p className="text-sm text-warm-text-muted">
              No words collected yet. Flip cards, match, or spell to collect words!
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {words.slice(0, 50).map((w, i) => (
            <motion.div key={`${w.word}-${i}`} variants={staggerItem}>
              <button
                onClick={() => setSelectedWord(w)}
                className="w-full rounded-xl border border-warm-border bg-warm-surface p-3 text-left transition-colors hover:border-warm-accent/40"
              >
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-serif)] text-base font-normal text-warm-text">
                    {w.word}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); playAudio(w.word); }}
                    className="text-warm-text-subtle hover:text-warm-accent"
                  >
                    <Volume2 className="size-3" />
                  </Button>
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Word Detail Dialog */}
      <AnimatePresence>
        {selectedWord && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedWord(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-warm-border bg-warm-surface p-6 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springSnappy}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-serif)] text-2xl text-warm-text">
                    {selectedWord.word}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => playAudio(selectedWord.word)}
                    className="text-warm-text-muted hover:text-warm-accent"
                  >
                    <Volume2 className="size-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedWord(null)}
                  className="text-warm-text-muted hover:text-warm-text"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-xs text-warm-text-muted">Definition</Label>
                  <p className="mt-1 text-sm text-warm-text">{selectedWord.definition}</p>
                </div>
                {selectedWord.exampleSentence && (
                  <div>
                    <Label className="text-xs text-warm-text-muted">Example</Label>
                    <p className="mt-1 text-sm italic text-warm-text-muted">
                      &ldquo;{selectedWord.exampleSentence}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module Progress */}
      <h2 className="mb-3 text-lg font-medium text-warm-text">Progress by Module</h2>
      {progress.length === 0 ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <BookOpen className="size-10 text-warm-text-subtle" />
            <p className="text-sm text-warm-text-muted">
              No progress yet. Start studying to see your progress here!
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {progress.map((p) => {
            const progressPercent =
              p.cardsTotal > 0 ? Math.round((p.cardsStudied / p.cardsTotal) * 100) : 0;

            return (
              <motion.div key={p.id} variants={staggerItem}>
                <Card className="border-warm-border bg-warm-surface">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-warm-text">
                        {p.moduleTitle}
                      </h3>
                      <span className="text-sm font-medium text-warm-accent">
                        {p.score}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-warm-surface-2">
                      <motion.div
                        className="h-full rounded-full bg-warm-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={springSnappy}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-warm-text-muted">
                      <span className="flex items-center gap-1">
                        <BookOpen className="size-3" />
                        {p.cardsStudied}/{p.cardsTotal} cards
                      </span>
                      <span className="flex items-center gap-1 text-warm-correct">
                        <CheckCircle className="size-3" />
                        {p.correctCount} correct
                      </span>
                      <span className="flex items-center gap-1 text-warm-wrong">
                        <XCircle className="size-3" />
                        {p.wrongCount} wrong
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(p.lastStudied)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
