"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  BookOpen,
  Trash2,
  Pencil,
  Calendar,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/animations";
import { toast } from "sonner";

interface ClassItem {
  id: string;
  name: string;
  teacherId: string;
  studentUids: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function ClassesPage() {
  const { uid } = useAuthStore();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    fetchClasses();
  }, [uid]);

  async function fetchClasses() {
    if (!uid) return;
    try {
      const q = query(
        collection(db, "classes"),
        where("teacherId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClassItem[];
      setClasses(items);
    } catch (err) {
      console.error("Error fetching classes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass() {
    if (!uid || !newClassName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "classes"), {
        name: newClassName.trim(),
        teacherId: uid,
        studentUids: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Class created successfully");
      setShowNewDialog(false);
      setNewClassName("");
      setLoading(true);
      await fetchClasses();
    } catch (err) {
      toast.error("Failed to create class");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!selectedClass || !renameValue.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "classes", selectedClass.id), {
        name: renameValue.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Class renamed");
      setShowRenameDialog(false);
      setRenameValue("");
      setSelectedClass(null);
      await fetchClasses();
    } catch (err) {
      toast.error("Failed to rename class");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedClass) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "classes", selectedClass.id));
      toast.success("Class deleted");
      setShowDeleteDialog(false);
      setSelectedClass(null);
      await fetchClasses();
    } catch (err) {
      toast.error("Failed to delete class");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(ts: Timestamp | undefined) {
    if (!ts) return "N/A";
    try {
      const date = new Date(ts.seconds * 1000);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  }

  return (
    <motion.div {...pageTransition} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Classes
          </h1>
          <p className="mt-1 text-warm-text-muted">
            Manage your classes and student groups
          </p>
        </div>
        <Button
          onClick={() => setShowNewDialog(true)}
          className="bg-warm-accent text-white hover:bg-warm-accent-dark"
        >
          <Plus className="mr-2 size-4" />
          New Class
        </Button>
      </div>

      {/* Class list */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-6"
            >
              <div className="h-5 w-32 rounded bg-warm-surface-2" />
              <div className="mt-3 h-3 w-20 rounded bg-warm-surface-2" />
              <div className="mt-6 h-8 w-24 rounded bg-warm-surface-2" />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="border-warm-border bg-warm-surface">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="mb-4 size-12 text-warm-text-subtle" />
            <h3 className="text-lg font-medium text-warm-text">No classes yet</h3>
            <p className="mt-1 text-sm text-warm-text-muted">
              Create your first class to get started
            </p>
            <Button
              onClick={() => setShowNewDialog(true)}
              className="mt-4 bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              <Plus className="mr-2 size-4" />
              Create Class
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
          {classes.map((cls) => (
            <motion.div key={cls.id} variants={staggerItem}>
              <Card className="border-warm-border bg-warm-surface transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-warm-text">{cls.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-warm-text-muted hover:text-warm-text"
                        onClick={() => {
                          setSelectedClass(cls);
                          setRenameValue(cls.name);
                          setShowRenameDialog(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-warm-text-muted hover:text-red-500"
                        onClick={() => {
                          setSelectedClass(cls);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-warm-text-muted">
                      <Users className="size-4" />
                      <span>
                        {cls.studentUids?.length ?? 0} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-warm-text-muted">
                      <Calendar className="size-4" />
                      <span>Created {formatDate(cls.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* New Class Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-text">Create New Class</DialogTitle>
            <DialogDescription className="text-warm-text-muted">
              Enter a name for your new class
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-warm-text">Class Name</Label>
              <Input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Grade 10 English A"
                className="border-warm-border bg-warm-bg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateClass();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewDialog(false);
                setNewClassName("");
              }}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClass}
              disabled={!newClassName.trim() || saving}
              className="bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-text">Rename Class</DialogTitle>
            <DialogDescription className="text-warm-text-muted">
              Enter a new name for this class
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-warm-text">Class Name</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="border-warm-border bg-warm-bg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameDialog(false);
                setSelectedClass(null);
              }}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || saving}
              className="bg-warm-accent text-white hover:bg-warm-accent-dark"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="border-warm-border bg-warm-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-text">Delete Class</DialogTitle>
            <DialogDescription className="text-warm-text-muted">
              Are you sure you want to delete &quot;{selectedClass?.name}&quot;? This
              action cannot be undone. Students in this class will not be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedClass(null);
              }}
              className="border-warm-border text-warm-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
