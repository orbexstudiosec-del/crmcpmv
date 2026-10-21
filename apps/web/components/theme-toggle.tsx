"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-primary hover:text-primary ${className}`}
    >
      {/* Evita parpadeo de icono hasta saber el tema real */}
      {mounted && dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
