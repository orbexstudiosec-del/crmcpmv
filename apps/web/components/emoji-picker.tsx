"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😉", "😎", "🤔",
  "😅", "😢", "😭", "😡", "😴", "🥳", "😱", "🤗", "🙄", "😇",
  "👍", "👎", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "👌",
  "❤️", "💙", "💚", "💛", "🧡", "💜", "🖤", "💔", "💯", "✨",
  "🔥", "🎉", "🎂", "🎁", "⭐", "✅", "❌", "⚠️", "❓", "❗",
  "📌", "📎", "📅", "⏰", "💰", "💵", "📈", "📉", "📞", "📧",
  "🚀", "☕", "🍕", "🍺", "🌞", "🌙", "🌧️", "🐶", "🐱", "🌸",
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground"
        title="Emojis"
      >
        <Smile size={17} />
      </button>
      {abierto && (
        <div className="absolute bottom-11 right-0 z-10 grid w-64 grid-cols-8 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onSelect(e); setAbierto(false); }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg transition hover:bg-surface"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
