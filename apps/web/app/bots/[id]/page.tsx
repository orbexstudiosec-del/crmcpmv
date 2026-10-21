"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { BotBuilder, type BotFlowDetalle } from "@/components/bots/bot-builder";

export default function BotEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bot, setBot] = useState<BotFlowDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BotFlowDetalle>(`/bots/${id}`)
      .then(setBot)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error");
        router.replace("/bots");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return null;

  if (!bot) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </AppShell>
    );
  }

  // BotBuilder se posiciona fixed y cubre toda la pantalla (menos el sidebar) para darle
  // espacio real al canvas — por eso igual va dentro de AppShell (así el sidebar se renderiza),
  // pero visualmente tapa el TopBar y el padding normal del <main>.
  return (
    <AppShell>
      <BotBuilder initial={bot} />
    </AppShell>
  );
}
