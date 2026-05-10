"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

export function useAuthInit() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    const unsub = init();
    return unsub;
  }, [init]);
}
