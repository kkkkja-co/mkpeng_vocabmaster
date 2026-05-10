"use client";

import { create } from "zustand";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth as getAuthInstance, db as getDbInstance } from "@/lib/firebase";
import { normalizeUser, type UserDoc } from "@/lib/guardrails";
import { encrypt, decrypt } from "@/lib/crypto";

const ALLOWED_DOMAINS = ["makopan.edu.hk", "bunorden.com"];

function isAllowedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

interface AuthState {
  uid: string | null;
  role: "student" | "teacher" | null;
  userDoc: UserDoc | null;
  loading: boolean;
  name?: string;
  className?: string;
  classNum?: string;

  // Google sign-in
  signInWithGoogle: () => Promise<void>;
  // Email/password sign-in (creates account if first time)
  signInWithEmail: (email: string, password: string) => Promise<void>;
  // Logout
  logout: () => Promise<void>;
  // Update student class (one-time selection)
  updateClass: (className: string, classNum: string) => Promise<void>;
  // Init listener
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  role: null,
  userDoc: null,
  loading: true,
  name: undefined,
  className: undefined,
  classNum: undefined,

  init: () => {
    const unsub = onAuthStateChanged(getAuthInstance(), async (firebaseUser) => {
      if (!firebaseUser) {
        set({ uid: null, role: null, userDoc: null, loading: false });
        return;
      }

      const uid = firebaseUser.uid;
      const email = firebaseUser.email;

      if (!email || !isAllowedEmail(email)) {
        await fbSignOut(getAuthInstance());
        set({ uid: null, role: null, userDoc: null, loading: false });
        return;
      }

      const userRef = doc(getDbInstance(), "users", uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = normalizeUser(snap.data() as Record<string, unknown>);
        if (data.role === "student") {
          const name = await decrypt(data.nameEnc);
          const className = await decrypt(data.classEnc);
          const classNum = await decrypt(data.classNumEnc);
          set({ uid, role: data.role, userDoc: data, loading: false, name, className, classNum });
        } else {
          set({ uid, role: data.role, userDoc: data, loading: false, name: email.split("@")[0] });
        }
      } else {
        // First-time user — determine role and create doc
        const isTeacher = await checkIsTeacher(email);
        const role = isTeacher ? "teacher" : "student";

        if (isTeacher) {
          const userDoc = {
            firebaseUid: uid,
            role: "teacher" as const,
            nameEnc: await encrypt(email.split("@")[0]),
            classEnc: await encrypt(""),
            classNumEnc: await encrypt(""),
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          };
          await setDoc(userRef, userDoc);
          set({ uid, role, userDoc: normalizeUser(userDoc), loading: false, name: email.split("@")[0] });
        } else {
          // Create student document with default values
          const userDoc = {
            firebaseUid: uid,
            role: "student" as const,
            nameEnc: await encrypt(email.split("@")[0]),
            classEnc: await encrypt(""),
            classNumEnc: await encrypt(""),
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          };
          await setDoc(userRef, userDoc);
          set({
            uid,
            role,
            userDoc: normalizeUser(userDoc),
            loading: false,
            name: email.split("@")[0],
            className: "",
            classNum: ""
          });
        }
      }
    });
    return unsub;
  },

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(getAuthInstance(), provider);
    const email = cred.user.email;
    if (!email || !isAllowedEmail(email)) {
      await fbSignOut(getAuthInstance());
      throw new Error(`Only @makopan.edu.hk and @bunorden.com emails are allowed.`);
    }
  },

  signInWithEmail: async (email, password) => {
    if (!isAllowedEmail(email)) {
      throw new Error(`Only @makopan.edu.hk and @bunorden.com emails are allowed.`);
    }

    const authInstance = getAuthInstance();
    try {
      await signInWithEmailAndPassword(authInstance, email, password);
    } catch (err: unknown) {
      // If user doesn't exist, create account then sign in
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        await createUserWithEmailAndPassword(authInstance, email, password);
        // init() listener will handle doc creation
      } else {
        throw err;
      }
    }
  },

  logout: async () => {
    await fbSignOut(getAuthInstance());
    set({ uid: null, role: null, userDoc: null, name: undefined, className: undefined, classNum: undefined });
  },

  updateClass: async (className, classNum) => {
    const currentUid = useAuthStore.getState().uid;
    if (!currentUid) throw new Error("Not authenticated");
    const userRef = doc(getDbInstance(), "users", currentUid);
    await updateDoc(userRef, {
      classEnc: await encrypt(className),
      classNumEnc: await encrypt(classNum),
    });
    set({ className, classNum });
  },
}));

async function checkIsTeacher(email: string): Promise<boolean> {
  const dbInstance = getDbInstance();
  const docRef = doc(dbInstance, "config", "teachers");
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  const emails = data?.emails as string[] | undefined;
  return emails?.includes(email.toLowerCase()) ?? false;
}
