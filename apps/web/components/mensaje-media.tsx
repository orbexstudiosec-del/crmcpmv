"use client";

import { useEffect, useState } from "react";
import { Loader2, FileText, Download, RotateCw } from "lucide-react";
import { api } from "@/lib/api";

type Tipo = "TEXTO" | "IMAGEN" | "VIDEO" | "AUDIO" | "STICKER" | "DOCUMENTO";

interface MediaResp { base64: string; mimetype?: string }

export function MensajeMedia({
  conversacionId, mensajeId, tipo, contenido,
}: { conversacionId: string; mensajeId: string; tipo: Tipo; contenido: string }) {
  const [media, setMedia] = useState<MediaResp | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    api<MediaResp>(`/mensajes/conversaciones/${conversacionId}/mensajes/${mensajeId}/media`)
      .then(setMedia)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajeId]);

  if (error) {
    return (
      <button onClick={cargar} className="flex items-center gap-1.5 text-xs opacity-90 underline underline-offset-2">
        <RotateCw size={11} /> {error}
      </button>
    );
  }
  if (cargando || !media) {
    return <p className="flex items-center gap-1.5 text-xs opacity-80"><Loader2 size={12} className="animate-spin" /> Cargando…</p>;
  }

  const src = `data:${media.mimetype ?? "application/octet-stream"};base64,${media.base64}`;

  if (tipo === "AUDIO") {
    return <audio controls src={src} className="max-w-full" style={{ height: 32 }} />;
  }
  if (tipo === "IMAGEN" || tipo === "STICKER") {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={contenido} className="max-h-64 max-w-full rounded-lg object-contain" />
        {tipo === "IMAGEN" && contenido !== "Imagen" && <p className="mt-1 whitespace-pre-wrap break-words">{contenido}</p>}
      </div>
    );
  }
  if (tipo === "VIDEO") {
    return (
      <div>
        <video controls src={src} className="max-h-64 max-w-full rounded-lg" />
        {contenido !== "Video" && <p className="mt-1 whitespace-pre-wrap break-words">{contenido}</p>}
      </div>
    );
  }
  // DOCUMENTO — el mimetype lo declara quien envía el archivo; se fuerza descarga binaria para
  // que un "documento" text/html o svg nunca se abra como página dentro del CRM.
  return (
    <a href={`data:application/octet-stream;base64,${media.base64}`} download={contenido} className="flex items-center gap-2 underline underline-offset-2">
      <FileText size={16} /> {contenido} <Download size={12} />
    </a>
  );
}
