"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Plus,
  Loader2,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageTransition } from "@/lib/animations";
import { toast } from "sonner";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PARTS = ["Part A", "B1", "B2", "Uncategorized"];

export default function NewModulePage() {
  const { uid } = useAuthStore();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [part, setPart] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!uid || !title.trim()) return;
    setSaving(true);
    try {
      const modRef = await addDoc(collection(db(), "modules"), {
        title: title.trim(),
        description: description.trim(),
        level,
        part,
        published: false,
        assignedClasses: [],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalCards: 0,
      });

      toast.success("Module created");
      router.push(`/teacher/modules/${modRef.id}`);
    } catch (err) {
      toast.error("Failed to create module");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function SelectChips({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <div className="space-y-2">
        <Label className="text-warm-text">{label}</Label>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(value === opt ? "" : opt)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all ${
                value === opt
                  ? "border-warm-accent bg-warm-accent/10 text-warm-accent"
                  : "border-warm-border bg-warm-surface text-warm-text-muted hover:border-warm-text-subtle"
              }`}
            >
              {value === opt && <Check className="size-3" />}
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div {...pageTransition} className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="text-warm-text-muted hover:text-warm-text"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to Modules
      </Button>

      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
          Create New Module
        </h1>
        <p className="mt-1 text-warm-text-muted">
          Set up a new vocabulary module with details and categories
        </p>
      </div>

      <Card className="border-warm-border bg-warm-surface">
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label className="text-warm-text">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 1: Greetings and Introductions"
              className="border-warm-border bg-warm-bg"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-warm-text">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this module's content"
              className="border-warm-border bg-warm-bg"
            />
          </div>

          <SelectChips
            label="Level"
            options={LEVELS}
            value={level}
            onChange={setLevel}
          />

          <SelectChips
            label="Part"
            options={PARTS}
            value={part}
            onChange={setPart}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-warm-border">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || saving}
              className="bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Create Module
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
