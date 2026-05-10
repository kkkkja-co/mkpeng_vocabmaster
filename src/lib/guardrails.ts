import { Timestamp } from "firebase/firestore";

// ── Types ──

export interface UserDoc {
  firebaseUid: string;
  role: "student" | "teacher";
  nameEnc: string;
  classEnc: string;
  classNumEnc: string;
  createdAt: Timestamp;
  lastActive: Timestamp;
}

export interface ClassDoc {
  name: string;
  teacherId: string;
  studentUids: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ModuleDoc {
  title: string;
  description: string;
  subject: string;
  level: string;
  part: string;
  published: boolean;
  assignedClasses: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  totalCards: number;
}

export interface CardDoc {
  word: string;
  definitionEnc: string;
  chineseMeaningEnc: string;
  exampleSentenceEnc: string;
  partTag: string;
  order: number;
  audioUrl: string | null;
  createdAt: Timestamp;
}

export interface ProgressDoc {
  userId: string;
  moduleId: string;
  cardsStudied: number;
  cardsTotal: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  avgResponseMs: number;
  completedAt: Timestamp | null;
  lastStudied: Timestamp;
}

export interface BattleDoc {
  status: "waiting" | "countdown" | "active" | "finished";
  moduleId: string;
  hostId: string;
  inviteCode: string;
  currentCardIndex: number;
  currentCardStart: Timestamp | null;
  timePerCard: number;
  totalCards: number;
  createdAt: Timestamp;
}

export interface PlayerDoc {
  displayName: string;
  class: string;
  score: number;
  streak: number;
  answeredCards: string[];
  status: "ready" | "answered" | "waiting";
  lastAnswerTime: Timestamp | null;
  isHost: boolean;
}

export interface AnswerDoc {
  uid: string;
  cardIndex: number;
  answeredAt: Timestamp;
  correct: boolean;
  responseMs: number;
}

// ── Normalizers ──

export function normalizeUser(data: Record<string, unknown>): UserDoc {
  return {
    firebaseUid: (data.firebaseUid as string) ?? "",
    role: (data.role as "student" | "teacher") ?? "student",
    nameEnc: (data.nameEnc as string) ?? "",
    classEnc: (data.classEnc as string) ?? "",
    classNumEnc: (data.classNumEnc as string) ?? "",
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
    lastActive: (data.lastActive as Timestamp) ?? (data.createdAt as Timestamp) ?? Timestamp.now(),
  };
}

export function normalizeModule(data: Record<string, unknown>): ModuleDoc {
  return {
    title: (data.title as string) ?? "",
    description: (data.description as string) ?? "",
    subject: (data.subject as string) ?? "",
    level: (data.level as string) ?? "",
    part: (data.part as string) ?? "",
    published: (data.published as boolean) ?? false,
    assignedClasses: (data.assignedClasses as string[]) ?? [],
    createdBy: (data.createdBy as string) ?? "",
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
    updatedAt: (data.updatedAt as Timestamp) ?? Timestamp.now(),
    totalCards: (data.totalCards as number) ?? 0,
  };
}

export function normalizeCard(data: Record<string, unknown>): CardDoc {
  return {
    word: (data.word as string) ?? "",
    definitionEnc: (data.definitionEnc as string) ?? "",
    chineseMeaningEnc: (data.chineseMeaningEnc as string) ?? "",
    exampleSentenceEnc: (data.exampleSentenceEnc as string) ?? "",
    partTag: (data.partTag as string) ?? "",
    order: (data.order as number) ?? 0,
    audioUrl: (data.audioUrl as string) ?? null,
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
  };
}

export function normalizeProgress(data: Record<string, unknown>): ProgressDoc {
  return {
    userId: (data.userId as string) ?? "",
    moduleId: (data.moduleId as string) ?? "",
    cardsStudied: (data.cardsStudied as number) ?? 0,
    cardsTotal: (data.cardsTotal as number) ?? 0,
    score: (data.score as number) ?? 0,
    correctCount: (data.correctCount as number) ?? 0,
    wrongCount: (data.wrongCount as number) ?? 0,
    avgResponseMs: (data.avgResponseMs as number) ?? 0,
    completedAt: (data.completedAt as Timestamp) ?? null,
    lastStudied: (data.lastStudied as Timestamp) ?? Timestamp.now(),
  };
}

export function normalizePlayer(data: Record<string, unknown>): PlayerDoc {
  return {
    displayName: (data.displayName as string) ?? "",
    class: (data.class as string) ?? "",
    score: (data.score as number) ?? 0,
    streak: (data.streak as number) ?? 0,
    answeredCards: (data.answeredCards as string[]) ?? [],
    status: (data.status as "ready" | "answered" | "waiting") ?? "waiting",
    lastAnswerTime: (data.lastAnswerTime as Timestamp) ?? null,
    isHost: (data.isHost as boolean) ?? false,
  };
}

export function normalizeBattle(data: Record<string, unknown>): BattleDoc {
  return {
    status: (data.status as BattleDoc["status"]) ?? "waiting",
    moduleId: (data.moduleId as string) ?? "",
    hostId: (data.hostId as string) ?? "",
    inviteCode: (data.inviteCode as string) ?? "",
    currentCardIndex: (data.currentCardIndex as number) ?? 0,
    currentCardStart: (data.currentCardStart as Timestamp) ?? null,
    timePerCard: (data.timePerCard as number) ?? 15,
    totalCards: (data.totalCards as number) ?? 0,
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
  };
}
