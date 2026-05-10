import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface WordCollection {
  userId: string;
  words: Record<string, { word: string; definition: string; exampleSentence: string; collectedAt: number }>;
  count: number;
}

export interface MasteryLevel {
  level: number;
  name: string;
  threshold: number;
  icon: string;
}

export const MASTERY_LEVELS: MasteryLevel[] = [
  { level: 1, name: "Beginner", threshold: 10, icon: "🌱" },
  { level: 2, name: "Learner", threshold: 30, icon: "📖" },
  { level: 3, name: "Explorer", threshold: 60, icon: "🧭" },
  { level: 4, name: "Scholar", threshold: 100, icon: "🎓" },
  { level: 5, name: "Master", threshold: 150, icon: "👑" },
];

export function getMasteryLevel(wordCount: number): MasteryLevel & { progress: number } {
  let currentLevel = MASTERY_LEVELS[0];
  for (const level of MASTERY_LEVELS) {
    if (wordCount >= level.threshold) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const currentIdx = MASTERY_LEVELS.indexOf(currentLevel);
  const nextLevel = MASTERY_LEVELS[currentIdx + 1];

  let progress: number;
  if (currentIdx === MASTERY_LEVELS.length - 1) {
    progress = 100;
  } else if (nextLevel) {
    const rangeStart = currentLevel.threshold;
    const rangeEnd = nextLevel.threshold;
    progress = Math.min(100, Math.round(((wordCount - rangeStart) / (rangeEnd - rangeStart)) * 100));
  } else {
    progress = 100;
  }

  return { ...currentLevel, progress };
}

export async function addWordToCollection(
  userId: string,
  moduleId: string,
  wordId: string,
  word: string,
  definition: string,
  exampleSentence: string
) {
  const collectionRef = doc(db(), "collections", `${userId}_${moduleId}`);
  const snap = await getDoc(collectionRef);

  if (snap.exists()) {
    const data = snap.data();
    const words = (data.words as Record<string, unknown>) ?? {};
    if (!words[wordId]) {
      await updateDoc(collectionRef, {
        [`words.${wordId}`]: { word, definition, exampleSentence, collectedAt: Date.now() },
        count: (data.count as number) + 1,
        lastUpdated: serverTimestamp(),
      });
    }
  } else {
    await setDoc(collectionRef, {
      userId,
      moduleId,
      words: { [wordId]: { word, definition, exampleSentence, collectedAt: Date.now() } },
      count: 1,
      lastUpdated: serverTimestamp(),
    });
  }
}

export async function getUserCollections(userId: string) {
  const { collection: firestoreCollection, query, where, getDocs } = await import("firebase/firestore");
  const q = query(firestoreCollection(db(), "collections"), where("userId", "==", userId));
  const snap = await getDocs(q);

  let totalCount = 0;
  const allWords: Array<{
    word: string;
    definition: string;
    exampleSentence: string;
    collectedAt: number;
    moduleId: string;
  }> = [];

  snap.docs.forEach((d) => {
    const data = d.data();
    const count = (data.count as number) ?? 0;
    totalCount += count;
    const words = (data.words as Record<string, { word: string; definition: string; exampleSentence: string; collectedAt: number }>) ?? {};
    const moduleId = (data.moduleId as string) ?? "";
    Object.values(words).forEach((w) => {
      allWords.push({ ...w, moduleId });
    });
  });

  allWords.sort((a, b) => b.collectedAt - a.collectedAt);

  return { totalCount, words: allWords };
}
