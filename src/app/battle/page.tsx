"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeModule, type ModuleDoc } from "@/lib/guardrails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Swords, LogIn, Plus, Loader2, ArrowLeft } from "lucide-react";
import { pageTransition, springSnappy, staggerContainer, staggerItem } from "@/lib/animations";

interface ModuleItem {
  id: string;
  doc: ModuleDoc;
}

export default function BattleLobbyPage() {
  const router = useRouter();
  const { uid, name, className } = useAuthStore();

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);

  // Create state
  const [selectedModule, setSelectedModule] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Join state
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch published modules
  useEffect(() => {
    const q = query(
      collection(db, "modules"),
      where("published", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        doc: normalizeModule(d.data() as Record<string, unknown>),
      }));
      setModules(items);
      setModulesLoading(false);
    });
    return unsub;
  }, []);

  const handleCreateRoom = async () => {
    setCreateError("");
    if (!selectedModule) {
      setCreateError("Please select a module");
      return;
    }
    if (!uid) {
      setCreateError("You must be logged in");
      return;
    }

    setCreating(true);
    try {
      const module = modules.find((m) => m.id === selectedModule);
      const inviteCodeStr = nanoid(6).toUpperCase();
      const battleRef = await addDoc(collection(db, "battles"), {
        status: "waiting",
        moduleId: selectedModule,
        hostId: uid,
        inviteCode: inviteCodeStr,
        currentCardIndex: 0,
        currentCardStart: null,
        timePerCard: 15,
        totalCards: module?.doc.totalCards ?? 10,
        createdAt: serverTimestamp(),
      });

      // Add host as player
      await setDoc(doc(db, "battles", battleRef.id, "players", uid), {
        displayName: name ?? "Host",
        class: className ?? "",
        score: 0,
        streak: 0,
        answeredCards: [],
        status: "ready",
        lastAnswerTime: null,
        isHost: true,
      });

      router.push(`/battle/${battleRef.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    setJoinError("");
    if (!inviteCode.trim()) {
      setJoinError("Please enter an invite code");
      return;
    }
    if (!uid) {
      setJoinError("You must be logged in");
      return;
    }

    setJoining(true);
    try {
      const q = query(
        collection(db, "battles"),
        where("inviteCode", "==", inviteCode.trim().toUpperCase()),
        where("status", "==", "waiting")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError("No room found with that code. Check the code and try again.");
        setJoining(false);
        return;
      }

      const battleDoc = snap.docs[0];
      const battleId = battleDoc.id;

      // Check if player already joined
      const playerSnap = await getDocs(
        collection(db, "battles", battleId, "players")
      );
      const alreadyJoined = playerSnap.docs.some((d) => d.id === uid);

      if (!alreadyJoined) {
        await setDoc(doc(db, "battles", battleId, "players", uid), {
          displayName: name ?? "Player",
          class: className ?? "",
          score: 0,
          streak: 0,
          answeredCards: [],
          status: "waiting",
          lastAnswerTime: null,
          isHost: false,
        });
      }

      router.push(`/battle/${battleId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-4 py-8">
      <motion.div
        className="mx-auto max-w-lg"
        {...pageTransition}
      >
        {/* Back nav */}
        <motion.button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm text-warm-text-muted hover:text-warm-text transition-colors"
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <ArrowLeft className="size-4" />
          Back
        </motion.button>

        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-warm-battle/10"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springSnappy}
          >
            <Swords className="size-8 text-warm-battle" />
          </motion.div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Battle Mode
          </h1>
          <p className="mt-1 text-sm text-warm-text-muted">
            Challenge your classmates to a vocabulary showdown
          </p>
        </div>

        {/* Options */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {/* Create Room */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-[#faf7f2]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-warm-battle/10">
                    <Plus className="size-4 text-warm-battle" />
                  </div>
                  Create a Room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-warm-text">Module</Label>
                  <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v ?? "")}>
                    <SelectTrigger className="border-warm-border bg-[#f5f0e8]">
                      <SelectValue placeholder={modulesLoading ? "Loading modules..." : "Select a vocabulary module"} />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.doc.title}
                        </SelectItem>
                      ))}
                      {!modulesLoading && modules.length === 0 && (
                        <SelectItem value="none" disabled>
                          No modules available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {createError && (
                  <p className="text-sm text-warm-wrong">{createError}</p>
                )}

                <Button
                  onClick={handleCreateRoom}
                  disabled={creating || modulesLoading}
                  className="w-full bg-warm-battle text-white hover:bg-warm-battle/90"
                >
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Create Room"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Divider */}
          <motion.div variants={staggerItem} className="flex items-center gap-3">
            <div className="h-px flex-1 bg-warm-border" />
            <span className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
              or
            </span>
            <div className="h-px flex-1 bg-warm-border" />
          </motion.div>

          {/* Join Room */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-[#faf7f2]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-warm-accent/10">
                    <LogIn className="size-4 text-warm-accent" />
                  </div>
                  Join a Room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-warm-text">Invite Code</Label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-letter code"
                    maxLength={6}
                    className="border-warm-border bg-[#f5f0e8] font-[family-name:var(--font-mono)] text-center text-lg tracking-[0.3em] uppercase"
                  />
                </div>

                {joinError && (
                  <p className="text-sm text-warm-wrong">{joinError}</p>
                )}

                <Button
                  onClick={handleJoinRoom}
                  disabled={joining || inviteCode.length < 6}
                  className="w-full bg-warm-accent text-white hover:bg-warm-accent-dark"
                >
                  {joining ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Join Room"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </main>
  );
}
