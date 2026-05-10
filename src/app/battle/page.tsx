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
  getDoc,
  serverTimestamp,
  onSnapshot,
  documentId,
} from "firebase/firestore";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/auth-store";
import { normalizeModule, normalizeUser, type ModuleDoc, type UserDoc } from "@/lib/guardrails";
import { decrypt } from "@/lib/crypto";
import { getAllClasses } from "@/lib/firestore-helpers";
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
import { Swords, LogIn, Plus, Loader2, ArrowLeft, Users, Zap, ShieldOff } from "lucide-react";
import { pageTransition, springSnappy, staggerContainer, staggerItem } from "@/lib/animations";

interface ModuleItem {
  id: string;
  doc: ModuleDoc;
}

interface ChallengeUser {
  uid: string;
  name: string;
  className: string;
}

export default function BattleLobbyPage() {
  const router = useRouter();
  const { uid, name, className: myClassName } = useAuthStore();

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

  // Challenge state
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [challengeModule, setChallengeModule] = useState("");
  const [classStudents, setClassStudents] = useState<ChallengeUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState<string | null>(null);

  // Incoming challenges
  const [incomingChallenges, setIncomingChallenges] = useState<Array<{
    battleId: string;
    challengerName: string;
    moduleId: string;
    moduleTitle: string;
  }>>([]);

  // Fetch published modules
  useEffect(() => {
    const q = query(
      collection(db(), "modules"),
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

  // Fetch classes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allClasses = await getAllClasses();
        if (!cancelled) {
          setClasses(allClasses.map((c) => ({ id: c.id, name: String((c as Record<string, unknown>).name ?? "Unknown Class") })));
        }
      } catch (err) {
        console.error("Failed to load classes:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Subscribe to incoming challenges for current user
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db(), "battles"),
      where("opponentId", "==", uid),
      where("status", "==", "challenge_sent")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const challenges = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const challengerName = data.challengerName as string ?? "Someone";
          const moduleId = data.moduleId as string ?? "";
          let moduleTitle = "Unknown Module";
          try {
            const modSnap = await getDocs(query(collection(db(), "modules"), where(documentId(), "==", moduleId)));
            if (!modSnap.empty) {
              moduleTitle = (modSnap.docs[0].data().title as string) ?? "Unknown Module";
            }
          } catch {
            // ignore
          }
          return { battleId: d.id, challengerName, moduleId, moduleTitle };
        })
      );
      setIncomingChallenges(challenges);
    });
    return unsub;
  }, [uid]);

  // Load students for selected class
  useEffect(() => {
    if (!selectedClass) {
      setClassStudents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingStudents(true);
      try {
        const classDoc = classes.find((c) => c.id === selectedClass);
        if (!classDoc) return;

        const classSnap = await getDoc(doc(db(), "classes", selectedClass));
        if (!classSnap.exists()) return;
        const classData = classSnap.data();
        const studentUids = (classData.studentUids as string[]) ?? [];

        if (studentUids.length === 0) return;

        // Fetch student docs in batches (Firestore IN limit is 10)
        const students: ChallengeUser[] = [];
        for (let i = 0; i < studentUids.length; i += 10) {
          const batch = studentUids.slice(i, i + 10);
          const usersQuery = query(
            collection(db(), "users"),
            where("firebaseUid", "in", batch)
          );
          const usersSnap = await getDocs(usersQuery);
          for (const uDoc of usersSnap.docs) {
            const uData = uDoc.data();
            if (uData.role !== "student") continue;
            const studentName = uData.nameEnc ? await decrypt(uData.nameEnc) : "Student";
            const studentClass = uData.classEnc ? await decrypt(uData.classEnc) : "";
            students.push({
              uid: uData.firebaseUid as string,
              name: studentName,
              className: studentClass,
            });
          }
        }

        if (!cancelled) setClassStudents(students.filter((s) => s.uid !== uid));
      } catch (err) {
        console.error("Failed to load students:", err);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClass, classes, uid]);

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
      const battleRef = await addDoc(collection(db(), "battles"), {
        status: "waiting",
        battleType: "quiz",
        moduleId: selectedModule,
        hostId: uid,
        inviteCode: inviteCodeStr,
        currentCardIndex: 0,
        currentCardStart: null,
        timePerCard: 15,
        totalCards: module?.doc.totalCards ?? 10,
        challengerId: "",
        opponentId: "",
        opponentClass: "",
        createdAt: serverTimestamp(),
      });

      // Add host as player
      await setDoc(doc(db(), "battles", battleRef.id, "players", uid), {
        displayName: name ?? "Host",
        class: myClassName ?? "",
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
        collection(db(), "battles"),
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
        collection(db(), "battles", battleId, "players")
      );
      const alreadyJoined = playerSnap.docs.some((d) => d.id === uid);

      if (!alreadyJoined) {
        await setDoc(doc(db(), "battles", battleId, "players", uid), {
          displayName: name ?? "Player",
          class: myClassName ?? "",
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

  const handleSendChallenge = async (opponent: ChallengeUser) => {
    if (!uid || !challengeModule) return;
    setSendingChallenge(opponent.uid);
    try {
      const module = modules.find((m) => m.id === challengeModule);
      const battleRef = await addDoc(collection(db(), "battles"), {
        status: "challenge_sent",
        battleType: "spelling",
        moduleId: challengeModule,
        hostId: uid,
        inviteCode: "",
        currentCardIndex: 0,
        currentCardStart: null,
        timePerCard: 15,
        totalCards: module?.doc.totalCards ?? 10,
        challengerId: uid,
        challengerName: name ?? "Someone",
        opponentId: opponent.uid,
        opponentClass: opponent.className,
        createdAt: serverTimestamp(),
      });

      // Add both as players
      await setDoc(doc(db(), "battles", battleRef.id, "players", uid), {
        displayName: name ?? "Challenger",
        class: myClassName ?? "",
        score: 0,
        streak: 0,
        answeredCards: [],
        status: "ready",
        lastAnswerTime: null,
        isHost: true,
      });
      await setDoc(doc(db(), "battles", battleRef.id, "players", opponent.uid), {
        displayName: opponent.name,
        class: opponent.className,
        score: 0,
        streak: 0,
        answeredCards: [],
        status: "waiting",
        lastAnswerTime: null,
        isHost: false,
      });

      router.push(`/battle/${battleRef.id}`);
    } catch (err) {
      console.error("Failed to send challenge:", err);
    } finally {
      setSendingChallenge(null);
    }
  };

  const handleAcceptChallenge = async (battleId: string) => {
    try {
      await setDoc(
        doc(db(), "battles", battleId),
        { status: "countdown" },
        { merge: true }
      );
      router.push(`/battle/${battleId}`);
    } catch (err) {
      console.error("Failed to accept challenge:", err);
    }
  };

  const handleRejectChallenge = async (battleId: string) => {
    try {
      await setDoc(
        doc(db(), "battles", battleId),
        { status: "challenge_denied" },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to reject challenge:", err);
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

        {/* Incoming Challenges */}
        <AnimatePresence>
          {incomingChallenges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="mb-3 text-sm font-medium text-warm-text flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                Incoming Challenges
              </h2>
              <div className="space-y-2">
                {incomingChallenges.map((ch) => (
                  <Card key={ch.battleId} className="border-amber-300 bg-amber-50">
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium text-warm-text">
                          {ch.challengerName}
                        </p>
                        <p className="text-xs text-warm-text-muted">{ch.moduleTitle} — Spelling Battle</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectChallenge(ch.battleId)}
                          className="border-warm-wrong text-warm-wrong hover:bg-warm-wrong/10"
                        >
                          <ShieldOff className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptChallenge(ch.battleId)}
                          className="bg-warm-correct text-white hover:bg-warm-correct/90"
                        >
                          Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

          {/* Divider */}
          <motion.div variants={staggerItem} className="flex items-center gap-3">
            <div className="h-px flex-1 bg-warm-border" />
            <span className="text-xs font-medium uppercase tracking-wider text-warm-text-subtle">
              or
            </span>
            <div className="h-px flex-1 bg-warm-border" />
          </motion.div>

          {/* Challenge by Class */}
          <motion.div variants={staggerItem}>
            <Card className="border-warm-border bg-[#faf7f2]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warm-text">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <Zap className="size-4 text-purple-600" />
                  </div>
                  Challenge by Class
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-warm-text">Class</Label>
                  <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "")}>
                    <SelectTrigger className="border-warm-border bg-[#f5f0e8]">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {classes.length === 0 && (
                        <SelectItem value="none" disabled>No classes available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-warm-text">Module (Spelling Battle)</Label>
                  <Select value={challengeModule} onValueChange={(v) => setChallengeModule(v ?? "")}>
                    <SelectTrigger className="border-warm-border bg-[#f5f0e8]">
                      <SelectValue placeholder={modulesLoading ? "Loading..." : "Select module"} />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.doc.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClass && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-warm-text">
                      <Users className="size-3.5" />
                      Students
                    </Label>
                    {loadingStudents ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="size-4 animate-spin text-warm-accent" />
                      </div>
                    ) : classStudents.length === 0 ? (
                      <p className="text-sm text-warm-text-muted p-2">No students in this class</p>
                    ) : (
                      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-warm-border p-2">
                        {classStudents.map((student) => (
                          <div
                            key={student.uid}
                            className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-warm-surface-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-600">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-warm-text">{student.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendChallenge(student)}
                              disabled={!challengeModule || sendingChallenge === student.uid}
                              className="border-purple-300 text-purple-600 hover:bg-purple-50"
                            >
                              {sendingChallenge === student.uid ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                "Challenge"
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </main>
  );
}
