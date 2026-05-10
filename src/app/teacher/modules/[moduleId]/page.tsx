"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Upload,
  Volume2,
  Eye,
  Loader2,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthStore } from "@/lib/auth-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { encrypt, decrypt } from "@/lib/crypto";
import { pageTransition } from "@/lib/animations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PARTS = ["Part A", "B1", "B2", "Uncategorized"];

interface ModuleSettings {
  title: string;
  description: string;
  level: string;
  part: string;
  published: boolean;
  assignedClasses: string[];
  totalCards: number;
}

interface CardItem {
  id: string;
  word: string;
  definition: string;
  chineseMeaning: string;
  exampleSentence: string;
  partTag: string;
  order: number;
  audioUrl: string | null;
}

interface ClassOption {
  id: string;
  name: string;
}

export default function ModuleEditorPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  const router = useRouter();
  const { uid } = useAuthStore();

  const [settings, setSettings] = useState<ModuleSettings>({
    title: "",
    description: "",
    level: "",
    part: "",
    published: false,
    assignedClasses: [],
    totalCards: 0,
  });
  const [cards, setCards] = useState<CardItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Card editor state
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CardItem | null>(null);
  const [cardForm, setCardForm] = useState({
    word: "",
    definition: "",
    chineseMeaning: "",
    exampleSentence: "",
    partTag: "",
  });
  const [cardSaving, setCardSaving] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [previewCard, setPreviewCard] = useState<CardItem | null>(null);

  const fetchModule = useCallback(async () => {
    try {
      const modSnap = await getDoc(doc(db(), "modules", moduleId));
      if (!modSnap.exists()) {
        toast.error("Module not found");
        router.push("/teacher/modules");
        return;
      }

      const modData = modSnap.data();

      // Decrypt description
      let description = (modData.description as string) ?? "";
      if (description && description.includes(".")) {
        try {
          description = await decrypt(description);
        } catch {
          // Not encrypted, use as-is
        }
      }

      setSettings({
        title: (modData.title as string) ?? "",
        description,
        level: (modData.level as string) ?? "",
        part: (modData.part as string) ?? "",
        published: (modData.published as boolean) ?? false,
        assignedClasses: (modData.assignedClasses as string[]) ?? [],
        totalCards: (modData.totalCards as number) ?? 0,
      });

      // Fetch cards
      const cardsSnap = await getDocs(
        query(
          collection(db(), "modules", moduleId, "cards"),
          orderBy("order", "asc")
        )
      );

      const cardList: CardItem[] = [];
      for (const cDoc of cardsSnap.docs) {
        const cData = cDoc.data();
        let definition = "";
        let chineseMeaning = "";
        let exampleSentence = "";

        try {
          definition = await decrypt(cData.definitionEnc as string);
        } catch {
          definition = (cData.definitionEnc as string) ?? "";
        }
        try {
          chineseMeaning = await decrypt(cData.chineseMeaningEnc as string);
        } catch {
          chineseMeaning = (cData.chineseMeaningEnc as string) ?? "";
        }
        try {
          exampleSentence = await decrypt(cData.exampleSentenceEnc as string);
        } catch {
          exampleSentence = (cData.exampleSentenceEnc as string) ?? "";
        }

        cardList.push({
          id: cDoc.id,
          word: (cData.word as string) ?? "",
          definition,
          chineseMeaning,
          exampleSentence,
          partTag: (cData.partTag as string) ?? "",
          order: (cData.order as number) ?? 0,
          audioUrl: (cData.audioUrl as string) ?? null,
        });
      }
      setCards(cardList);
    } catch (err) {
      console.error("Error fetching module:", err);
      toast.error("Failed to load module");
    } finally {
      setLoading(false);
    }
  }, [moduleId, router]);

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    if (!uid) return;
    try {
      const q = query(
        collection(db(), "classes"),
        where("teacherId", "==", uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name as string,
      }));
      setClasses(items);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }, [uid]);

  useEffect(() => {
    fetchModule();
    fetchClasses();
  }, [fetchModule, fetchClasses]);

  async function saveSettings() {
    setSaving(true);
    try {
      await updateDoc(doc(db(), "modules", moduleId), {
        title: settings.title,
        description: settings.description,
        level: settings.level,
        part: settings.part,
        assignedClasses: settings.assignedClasses,
        updatedAt: serverTimestamp(),
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    try {
      const newPublished = !settings.published;
      await updateDoc(doc(db(), "modules", moduleId), {
        published: newPublished,
        updatedAt: serverTimestamp(),
      });
      setSettings((s) => ({ ...s, published: newPublished }));
      toast.success(newPublished ? "Module published" : "Module unpublished");
    } catch (err) {
      toast.error("Failed to update publish status");
      console.error(err);
    }
  }

  function toggleClassAssignment(classId: string) {
    setSettings((s) => {
      const assigned = s.assignedClasses.includes(classId)
        ? s.assignedClasses.filter((id) => id !== classId)
        : [...s.assignedClasses, classId];
      return { ...s, assignedClasses: assigned };
    });
  }

  function openNewCard() {
    setEditingCard(null);
    setCardForm({
      word: "",
      definition: "",
      chineseMeaning: "",
      exampleSentence: "",
      partTag: "",
    });
    setShowCardDialog(true);
  }

  function openEditCard(card: CardItem) {
    setEditingCard(card);
    setCardForm({
      word: card.word,
      definition: card.definition,
      chineseMeaning: card.chineseMeaning,
      exampleSentence: card.exampleSentence,
      partTag: card.partTag,
    });
    setShowCardDialog(true);
  }

  async function saveCard() {
    if (!cardForm.word.trim()) {
      toast.error("Word is required");
      return;
    }
    setCardSaving(true);
    try {
      const definitionEnc = await encrypt(cardForm.definition);
      const chineseMeaningEnc = await encrypt(cardForm.chineseMeaning);
      const exampleSentenceEnc = await encrypt(cardForm.exampleSentence);

      if (editingCard) {
        // Update existing card
        await updateDoc(
          doc(db(), "modules", moduleId, "cards", editingCard.id),
          {
            word: cardForm.word.trim(),
            definitionEnc,
            chineseMeaningEnc,
            exampleSentenceEnc,
            partTag: cardForm.partTag,
          }
        );
        toast.success("Card updated");
      } else {
        // Create new card
        await addDoc(collection(db(), "modules", moduleId, "cards"), {
          word: cardForm.word.trim(),
          definitionEnc,
          chineseMeaningEnc,
          exampleSentenceEnc,
          partTag: cardForm.partTag,
          order: cards.length,
          audioUrl: null,
          createdAt: serverTimestamp(),
        });

        // Update total cards count
        await updateDoc(doc(db(), "modules", moduleId), {
          totalCards: cards.length + 1,
          updatedAt: serverTimestamp(),
        });
        toast.success("Card added");
      }

      setShowCardDialog(false);
      await fetchModule();
    } catch (err) {
      toast.error("Failed to save card");
      console.error(err);
    } finally {
      setCardSaving(false);
    }
  }

  async function deleteCard(cardId: string) {
    try {
      await deleteDoc(doc(db(), "modules", moduleId, "cards", cardId));
      await updateDoc(doc(db(), "modules", moduleId), {
        totalCards: Math.max(0, cards.length - 1),
        updatedAt: serverTimestamp(),
      });
      toast.success("Card deleted");
      await fetchModule();
    } catch (err) {
      toast.error("Failed to delete card");
      console.error(err);
    }
  }

  async function handleAudioUpload(cardId: string, file: File) {
    setAudioUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", `audio/${moduleId}/${cardId}`);

      const res = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();
      await updateDoc(
        doc(db(), "modules", moduleId, "cards", cardId),
        { audioUrl: url }
      );
      toast.success("Audio uploaded");
      await fetchModule();
    } catch (err) {
      toast.error("Failed to upload audio");
      console.error(err);
    } finally {
      setAudioUploading(false);
    }
  }

  if (loading) {
    return (
      <motion.div {...pageTransition} className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-warm-surface-2" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-80 rounded-xl bg-warm-surface-2" />
            <div className="h-80 rounded-xl bg-warm-surface-2" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...pageTransition} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-1 text-warm-text-muted hover:text-warm-text"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-serif)] text-2xl font-normal text-warm-text sm:text-3xl">
              {settings.title || "Untitled Module"}
            </h1>
            <Badge
              className={
                settings.published
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-warm-surface-2 text-warm-text-muted"
              }
              variant="secondary"
            >
              {settings.published ? "Published" : "Draft"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={togglePublish}
            className="border-warm-border text-warm-text"
          >
            {settings.published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-warm-accent text-white hover:bg-warm-accent-dark"
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Dual panel layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Settings */}
        <div className="space-y-4">
          <Card className="border-warm-border bg-warm-surface">
            <CardHeader>
              <CardTitle className="text-warm-text">Module Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-warm-text">Title</Label>
                <Input
                  value={settings.title}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, title: e.target.value }))
                  }
                  className="border-warm-border bg-warm-bg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-warm-text">Description</Label>
                <Input
                  value={settings.description}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, description: e.target.value }))
                  }
                  className="border-warm-border bg-warm-bg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-warm-text">Level</Label>
                  <Select
                    value={settings.level}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, level: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="border-warm-border bg-warm-bg">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-warm-text">Part</Label>
                  <Select
                    value={settings.part}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, part: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="border-warm-border bg-warm-bg">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned classes */}
          <Card className="border-warm-border bg-warm-surface">
            <CardHeader>
              <CardTitle className="text-warm-text">Assigned Classes</CardTitle>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-sm text-warm-text-muted">
                  No classes available. Create a class first.
                </p>
              ) : (
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                        settings.assignedClasses.includes(cls.id)
                          ? "border-warm-accent bg-warm-accent/5"
                          : "border-warm-border hover:bg-warm-surface-2"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={settings.assignedClasses.includes(cls.id)}
                        onChange={() => toggleClassAssignment(cls.id)}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                          settings.assignedClasses.includes(cls.id)
                            ? "border-warm-accent bg-warm-accent text-white"
                            : "border-warm-border"
                        )}
                      >
                        {settings.assignedClasses.includes(cls.id) && (
                          <Check className="size-3" />
                        )}
                      </div>
                      <span className="text-sm text-warm-text">{cls.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Card list */}
        <div>
          <Card className="border-warm-border bg-warm-surface">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-warm-text">
                Cards ({cards.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={openNewCard}
                className="bg-warm-accent text-white hover:bg-warm-accent-dark"
              >
                <Plus className="mr-1 size-3" />
                Add Card
              </Button>
            </CardHeader>
            <CardContent>
              {cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-warm-text-muted">
                    No cards yet. Add your first vocabulary card.
                  </p>
                  <Button
                    size="sm"
                    onClick={openNewCard}
                    className="mt-3"
                    variant="outline"
                  >
                    <Plus className="mr-1 size-3" />
                    Add Card
                  </Button>
                </div>
              ) : (
                <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                  {cards.map((card, idx) => (
                    <motion.div
                      key={card.id}
                      layout
                      className="group flex items-center gap-2 rounded-lg border border-warm-border bg-warm-bg p-3 transition-all hover:border-warm-accent/30"
                    >
                      <span className="w-6 shrink-0 text-center text-xs font-medium text-warm-text-subtle">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-warm-text">
                          {card.word}
                        </p>
                        <p className="truncate text-xs text-warm-text-muted">
                          {card.definition || "No definition"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-warm-text-muted hover:text-warm-text"
                          onClick={() => setPreviewCard(card)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-warm-text-muted hover:text-warm-text"
                          onClick={() => openEditCard(card)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-warm-text-muted hover:text-red-500"
                          onClick={() => deleteCard(card.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Card Editor Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-warm-text">
              {editingCard ? "Edit Card" : "Add New Card"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-warm-text">Word *</Label>
              <Input
                value={cardForm.word}
                onChange={(e) =>
                  setCardForm((f) => ({ ...f, word: e.target.value }))
                }
                placeholder="e.g. ubiquitous"
                className="border-warm-border bg-warm-bg font-[family-name:var(--font-mono)]"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-warm-text">Definition</Label>
              <Input
                value={cardForm.definition}
                onChange={(e) =>
                  setCardForm((f) => ({ ...f, definition: e.target.value }))
                }
                placeholder="Present, appearing, or found everywhere"
                className="border-warm-border bg-warm-bg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-warm-text">Chinese Meaning</Label>
              <Input
                value={cardForm.chineseMeaning}
                onChange={(e) =>
                  setCardForm((f) => ({ ...f, chineseMeaning: e.target.value }))
                }
                placeholder="无处不在的"
                className="border-warm-border bg-warm-bg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-warm-text">Example Sentence</Label>
              <Input
                value={cardForm.exampleSentence}
                onChange={(e) =>
                  setCardForm((f) => ({
                    ...f,
                    exampleSentence: e.target.value,
                  }))
                }
                placeholder="Smartphones have become ubiquitous in modern society."
                className="border-warm-border bg-warm-bg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-warm-text">Part of Speech Tag</Label>
              <Input
                value={cardForm.partTag}
                onChange={(e) =>
                  setCardForm((f) => ({ ...f, partTag: e.target.value }))
                }
                placeholder="adj."
                className="w-24 border-warm-border bg-warm-bg"
              />
            </div>

            {/* Live preview */}
            {cardForm.word && (
              <div className="rounded-lg border border-warm-border bg-warm-surface-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
                  Preview
                </p>
                <div className="mt-2">
                  <p className="font-[family-name:var(--font-serif)] text-xl text-warm-text">
                    {cardForm.word}
                    {cardForm.partTag && (
                      <span className="ml-2 text-sm text-warm-text-muted">
                        {cardForm.partTag}
                      </span>
                    )}
                  </p>
                  {cardForm.definition && (
                    <p className="mt-1 text-sm text-warm-text-muted">
                      {cardForm.definition}
                    </p>
                  )}
                  {cardForm.chineseMeaning && (
                    <p className="mt-1 text-sm text-warm-accent">
                      {cardForm.chineseMeaning}
                    </p>
                  )}
                  {cardForm.exampleSentence && (
                    <p className="mt-2 text-sm italic text-warm-text-muted">
                      &ldquo;{cardForm.exampleSentence}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCardDialog(false)}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={saveCard}
              disabled={!cardForm.word.trim() || cardSaving}
              className="bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              {cardSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              {editingCard ? "Update" : "Add"} Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Preview Dialog */}
      <Dialog open={!!previewCard} onOpenChange={() => setPreviewCard(null)}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-text">Card Preview</DialogTitle>
          </DialogHeader>
          {previewCard && (
            <div className="space-y-4 py-4">
              <div className="rounded-xl border border-warm-border bg-warm-bg p-6 text-center">
                <p className="font-[family-name:var(--font-serif)] text-3xl text-warm-text">
                  {previewCard.word}
                </p>
                {previewCard.partTag && (
                  <p className="mt-1 text-sm text-warm-text-muted">
                    {previewCard.partTag}
                  </p>
                )}
              </div>
              <div className="space-y-3 rounded-xl border border-warm-border bg-warm-bg p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
                    Definition
                  </p>
                  <p className="mt-1 text-sm text-warm-text">
                    {previewCard.definition || "N/A"}
                  </p>
                </div>
                <Separator className="bg-warm-border" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
                    Chinese
                  </p>
                  <p className="mt-1 text-sm text-warm-accent">
                    {previewCard.chineseMeaning || "N/A"}
                  </p>
                </div>
                <Separator className="bg-warm-border" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
                    Example
                  </p>
                  <p className="mt-1 text-sm italic text-warm-text-muted">
                    &ldquo;{previewCard.exampleSentence || "N/A"}&rdquo;
                  </p>
                </div>
              </div>
              {previewCard.audioUrl && (
                <audio controls className="w-full" src={previewCard.audioUrl}>
                  Your browser does not support audio.
                </audio>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewCard(null)}
              className="border-warm-border text-warm-text"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
