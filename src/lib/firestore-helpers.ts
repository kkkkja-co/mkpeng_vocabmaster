import {
  FirestoreError,
  Query,
  DocumentData,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeModule, normalizeUser, type ModuleDoc, type UserDoc } from "./guardrails";
import { decrypt } from "./crypto";

// ── Collection references ──
const USERS = "users";
const CLASSES = "classes";
const MODULES = "modules";
const PROGRESS = "progress";
const BATTLES = "battles";

// ── Helpers ──
function docData(doc: { data(): DocumentData }): Record<string, unknown> {
  return doc.data() as Record<string, unknown>;
}

// ── User helpers ──
export async function getUser(uid: string): Promise<UserDoc | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db(), USERS, uid));
  if (!snap.exists()) return null;
  return normalizeUser(docData(snap));
}

export async function getUserDecrypted(uid: string) {
  const user = await getUser(uid);
  if (!user) return null;
  return {
    ...user,
    name: await decrypt(user.nameEnc),
    class: await decrypt(user.classEnc),
    classNum: await decrypt(user.classNumEnc),
  };
}

export async function getTeachers(): Promise<UserDoc[]> {
  const { getDocs } = await import("firebase/firestore");
  const q = query(collection(db(), USERS), where("role", "==", "teacher"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeUser(docData(d)));
}

// ── Class helpers ──
export async function getClassesByTeacher(teacherId: string) {
  const { getDocs } = await import("firebase/firestore");
  const q = query(
    collection(db(), CLASSES),
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...docData(d) }));
}

export async function getAllClasses() {
  const { getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db(), CLASSES));
  return snap.docs.map((d) => ({ id: d.id, ...docData(d) }));
}

// ── Module helpers ──
export async function getPublishedModules(): Promise<(ModuleDoc & { id: string })[]> {
  const { getDocs } = await import("firebase/firestore");
  const q = query(
    collection(db(), MODULES),
    where("published", "==", true),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeModule(docData(d)) }));
}

export async function getModulesByTeacher(teacherId: string): Promise<(ModuleDoc & { id: string })[]> {
  const { getDocs } = await import("firebase/firestore");
  const q = query(
    collection(db(), MODULES),
    where("createdBy", "==", teacherId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeModule(docData(d)) }));
}

// ── Progress helpers ──
export async function getProgress(userId: string, moduleId: string) {
  const { doc, getDoc } = await import("firebase/firestore");
  const id = `${userId}_${moduleId}`;
  const snap = await getDoc(doc(db(), PROGRESS, id));
  if (!snap.exists()) return null;
  return docData(snap);
}

export async function getProgressByModule(moduleId: string) {
  const { getDocs } = await import("firebase/firestore");
  const q = query(collection(db(), PROGRESS), where("moduleId", "==", moduleId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...docData(d) }));
}
