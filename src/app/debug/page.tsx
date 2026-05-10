"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [info, setInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    setInfo({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "(empty)",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "(empty)",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "(empty)",
    });
  }, []);

  return (
    <pre style={{ padding: 20, fontFamily: "monospace" }}>
      {JSON.stringify(info, null, 2)}
    </pre>
  );
}
