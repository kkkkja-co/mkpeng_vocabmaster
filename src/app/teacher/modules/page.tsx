"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  BookOpen,
  Edit3,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  addDoc,
  getDoc,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/animations";
import { toast } from "sonner";

interface ModuleItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  part: string;
  published: boolean;
  assignedClasses: string[];
  createdBy: string;
  totalCards: number;
  createdAt: { seconds: number };
  updatedAt: { seconds: number };
}

export default function ModulesPage() {
  const { uid } = useAuthStore();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ModuleItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    fetchModules();
  }, [uid]);

  async function fetchModules() {
    if (!uid) return;
    try {
      const q = query(
        collection(db, "modules"),
        where("createdBy", "==", uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ModuleItem[];
      items.sort((a, b) => {
        const aTime = a.updatedAt?.seconds ?? 0;
        const bTime = b.updatedAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setModules(items);
    } catch (err) {
      console.error("Error fetching modules:", err);
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish(mod: ModuleItem) {
    setTogglingId(mod.id);
    try {
      await updateDoc(doc(db, "modules", mod.id), {
        published: !mod.published,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        mod.published ? "Module unpublished" : "Module published"
      );
      await fetchModules();
    } catch (err) {
      toast.error("Failed to update module");
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  }

  async function duplicateModule(mod: ModuleItem) {
    try {
      const newModRef = await addDoc(collection(db, "modules"), {
        title: `${mod.title} (Copy)`,
        description: mod.description,
        subject: mod.subject,
        level: mod.level,
        part: mod.part,
        published: false,
        assignedClasses: [],
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalCards: mod.totalCards,
      });

      // Copy cards
      const cardsSnap = await getDocs(
        collection(db, "modules", mod.id, "cards")
      );
      for (const cardDoc of cardsSnap.docs) {
        const cardData = cardDoc.data();
        await addDoc(collection(db, "modules", newModRef.id, "cards"), {
          ...cardData,
          createdAt: serverTimestamp(),
        });
      }

      toast.success("Module duplicated");
      await fetchModules();
    } catch (err) {
      toast.error("Failed to duplicate module");
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete cards subcollection
      const cardsSnap = await getDocs(
        collection(db, "modules", deleteTarget.id, "cards")
      );
      for (const cardDoc of cardsSnap.docs) {
        await deleteDoc(doc(db, "modules", deleteTarget.id, "cards", cardDoc.id));
      }
      await deleteDoc(doc(db, "modules", deleteTarget.id));
      toast.success("Module deleted");
      setDeleteTarget(null);
      await fetchModules();
    } catch (err) {
      toast.error("Failed to delete module");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(seconds: number) {
    return new Date(seconds * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <motion.div {...pageTransition} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Modules
          </h1>
          <p className="mt-1 text-warm-text-muted">
            Create and manage vocabulary modules
          </p>
        </div>
        <Button
          onClick={() => router.push("/teacher/modules/new")}
          className="bg-warm-accent text-white hover:bg-warm-accent-dark"
        >
          <Plus className="mr-2 size-4" />
          New Module
        </Button>
      </div>

      {/* Module grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-6"
            >
              <div className="h-5 w-36 rounded bg-warm-surface-2" />
              <div className="mt-2 h-3 w-48 rounded bg-warm-surface-2" />
              <div className="mt-6 flex gap-2">
                <div className="h-6 w-16 rounded bg-warm-surface-2" />
                <div className="h-6 w-16 rounded bg-warm-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="mb-4 size-12 text-warm-text-subtle" />
            <h3 className="text-lg font-medium text-warm-text">No modules yet</h3>
            <p className="mt-1 text-sm text-warm-text-muted">
              Create your first vocabulary module to get started
            </p>
            <Button
              onClick={() => router.push("/teacher/modules/new")}
              className="mt-4 bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              <Plus className="mr-2 size-4" />
              Create Module
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {modules.map((mod) => (
            <motion.div key={mod.id} variants={staggerItem}>
              <Card className="flex h-full flex-col border-warm-border bg-warm-surface transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate text-warm-text">
                        {mod.title}
                      </CardTitle>
                      {mod.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-warm-text-muted">
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        mod.published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-warm-surface-2 text-warm-text-muted"
                      }
                      variant="secondary"
                    >
                      {mod.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between pt-0">
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {mod.subject && (
                        <Badge variant="outline" className="border-warm-border text-xs text-warm-text-muted">
                          {mod.subject}
                        </Badge>
                      )}
                      {mod.level && (
                        <Badge variant="outline" className="border-warm-border text-xs text-warm-text-muted">
                          {mod.level}
                        </Badge>
                      )}
                      {mod.part && (
                        <Badge variant="outline" className="border-warm-border text-xs text-warm-text-muted">
                          {mod.part}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-warm-text-muted">
                      <Layers className="size-3" />
                      <span>{mod.totalCards} cards</span>
                      <span>&middot;</span>
                      <span>{mod.assignedClasses.length} classes</span>
                    </div>
                    <p className="text-xs text-warm-text-subtle">
                      Updated {formatDate(mod.updatedAt?.seconds ?? 0)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/teacher/modules/${mod.id}`)}
                      className="flex-1 border-warm-border text-warm-text hover:bg-warm-surface-2"
                    >
                      <Edit3 className="mr-1 size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-warm-text-muted hover:text-warm-text"
                      onClick={() => togglePublish(mod)}
                      disabled={togglingId === mod.id}
                      title={mod.published ? "Unpublish" : "Publish"}
                    >
                      {togglingId === mod.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : mod.published ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-warm-text-muted hover:text-warm-text"
                      onClick={() => duplicateModule(mod)}
                      title="Duplicate"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-warm-text-muted hover:text-red-500"
                      onClick={() => setDeleteTarget(mod)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-text">Delete Module</DialogTitle>
            <DialogDescription className="text-warm-text-muted">
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? All
              cards in this module will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
