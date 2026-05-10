"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BattleDoc } from "@/lib/guardrails";
import { springSnappy } from "@/lib/animations";

interface BattleCountdownProps {
  battleId: string;
  battle: BattleDoc;
}

export function BattleCountdown({ battleId, battle }: BattleCountdownProps) {
  const [count, setCount] = useState(3);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Reset to 3 when component mounts (status just changed to "countdown")
    setCount(3);

    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Transition to active
          if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            updateDoc(doc(db, "battles", battleId), {
              status: "active",
              currentCardIndex: 0,
              currentCardStart: serverTimestamp(),
            }).catch(console.error);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [battleId]);

  const circumference = 2 * Math.PI * 80;
  const progress = count > 0 ? (count / 3) : 0;
  const dashoffset = circumference * (1 - progress);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f0e8] px-4">
      <div className="text-center">
        {/* Countdown ring */}
        <div className="relative mx-auto mb-8 size-48">
          <svg
            className="size-full -rotate-90"
            viewBox="0 0 180 180"
          >
            {/* Background ring */}
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke="#e4ddd3"
              strokeWidth="6"
            />
            {/* Animated ring */}
            <motion.circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke="#0d9488"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: dashoffset }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
          </svg>

          {/* Number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {count > 0 ? (
                <motion.span
                  key={count}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={springSnappy}
                  className="font-[family-name:var(--font-serif)] text-7xl font-normal text-warm-battle"
                >
                  {count}
                </motion.span>
              ) : (
                <motion.span
                  key="go"
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springSnappy}
                  className="font-[family-name:var(--font-serif)] text-5xl font-normal text-warm-battle"
                >
                  Go!
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-warm-text-muted"
        >
          Get ready...
        </motion.p>
      </div>
    </div>
  );
}
