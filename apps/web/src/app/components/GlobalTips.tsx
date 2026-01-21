"use client";

import { useEffect, useState } from "react";

const TIPS = [
  "This is a social venue, not a race.",
  "You don’t need a reason to join a conversation.",
  "Curiosity is welcome. Pressure is not.",
  "Not every night needs a plan.",
  "Listening counts as participation.",
  "You don’t have to impress anyone here.",
  "Some conversations are brief. Some linger.",
  "Curiosity opens more doors than confidence."
];

export default function GlobalTips() {
  const [tip, setTip] = useState<string>(TIPS[0] ?? "");

  useEffect(() => {
    const pick = () => {
      const index = Math.floor(Math.random() * TIPS.length);
      setTip(TIPS[index] ?? TIPS[0] ?? "");
    };
    pick();
    const timer = setInterval(pick, 12000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 max-w-xs rounded-full border border-border-default bg-card/90 px-4 py-2 text-xs text-text-secondary shadow-sm">
      {tip}
    </div>
  );
}
