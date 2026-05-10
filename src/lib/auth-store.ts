"use client";

import { create } from "zustand";
import { onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizeUser, type UserDoc } from "@/lib/guardrails";
import { encrypt, decrypt } from "@/lib/crypto";

interface AuthState {
  uid: string | null;
  role: "student" | "teacher" | null;
  userDoc: UserDoc | null;
  loading: boolean;
  name?: string;
  className?: string;
  classNum?: string;

  // Student login
  studentLogin: (name: string, className: string, classNum: string) => Promise<void>;
  // Teacher login
  teacherLogin: (email: string, password: string) => Promise<void>;
  // Logout
  logout: () => Promise<void>;
  // Init listener
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  uid: null,
  role: null,
  userDoc: null,
  loading: true,
  name: undefined,
  className: undefined,
  classNum: undefined,

  init: () => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({ uid: null, role: null, userDoc: null, loading: false });
        return;
      }

      const uid = firebaseUser.uid;
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = normalizeUser(snap.data() as Record<string, unknown>);
        const name = await decrypt(data.nameEnc);
        const className = await decrypt(data.classEnc);
        const classNum = await decrypt(data.classNumEnc);
        set({ uid, role: data.role, userDoc: data, loading: false, name, className, classNum });
      } else {
        set({ uid, role: null, userDoc: null, loading: false });
      }
    });
    return unsub;
  },

  studentLogin: async (name, className, classNum) => {
    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    const [nameEnc, classEnc, classNumEnc] = await Promise.all([
      encrypt(name),
      encrypt(className),
      encrypt(classNum),
    ]);
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      firebaseUid: uid,
      role: "student",
      nameEnc,
      classEnc,
      classNumEnc,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    });
    set({ uid, role: "student", name, className, classNum });
  },

  teacherLogin: async (email, password) => {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = normalizeUser(snap.data() as Record<string, unknown>);
      set({ uid, role: data.role, userDoc: data });
    }
  },

  logout: async () => {
    await fbSignOut(auth);
    set({ uid: null, role: null, userDoc: null, name: undefined, className: undefined, classNum: undefined });
  },
}));
