"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useMarca } from "@/lib/marca";
import type { Marca } from "@totalcrm/shared";

const IMAGEN_MAX_BYTES = 300 * 1024;
const COLOR_DEFAULT = "#00953a"; // --color-primary de globals.css

/** Marca blanca de la instalación: el nombre, colores y logo con los que el CRM se presenta a
 * todo el equipo (login, menú, pestaña del navegador y correos). */
export function MarcaCard({ puedeEditar }: { puedeEditar: boolean }) {
  const { marca, setMarca } = useMarca();
  const [nombre, setNombre] = useState(marca.nombre);
  const [color, setColor] = useState(marca.colorPrimario);
  const [secundario, setSecundario] = useState(marca.colorSecundario);
  const [logo, setLogo] = useState(marca.logo);
  const [icono, setIcono] = useState(marca.icono);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      const actualizada = await api<Marca>("/marca", {
        method: "PATCH",
        body: JSON.stringify({ nombre, colorPrimario: color, colorSecundario: secundario, logo, icono }),
      });
      setMarca(actualizada);
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la marca");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card mt-6 p-5">
      <h2 className="font-display text-base font-bold text-foreground">Marca</h2>
      <p className="mt-1 text-xs text-muted">
        El nombre, los colores y el logo con los que tu equipo ve el sistema: en el acceso, el menú, la pestaña del navegador y los correos.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Marca actualizada.</p>}

      <fieldset disabled={!puedeEditar} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-foreground">Nombre del sistema</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            required
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60 sm:max-w-sm"
          />
        </label>

        <SelectorColor
          etiqueta="Color principal"
          ayuda="Botones, enlaces y menú lateral."
          valor={color}
          porDefecto={COLOR_DEFAULT}
          onCambio={setColor}
        />
        <SelectorColor
          etiqueta="Color secundario"
          ayuda="Acentos y resaltados."
          valor={secundario}
          porDefecto={color ?? COLOR_DEFAULT}
          onCambio={setSecundario}
        />

        <SelectorImagen
          etiqueta="Logo"
          ayuda="Versión horizontal para fondo oscuro (letras claras). Se usa en el menú y en el acceso."
          valor={logo}
          fondoOscuro
          onCambio={setLogo}
          onError={setError}
        />
        <SelectorImagen
          etiqueta="Ícono"
          ayuda="Solo el símbolo, sin texto. Se usa con el menú colapsado y en la pestaña del navegador."
          valor={icono}
          onCambio={setIcono}
          onError={setError}
        />
      </fieldset>

      {puedeEditar && (
        <button type="button" onClick={guardar} disabled={guardando || !nombre.trim()} className="btn-primary mt-4 px-4 py-2 text-sm disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar marca"}
        </button>
      )}
    </div>
  );
}

function SelectorColor({
  etiqueta, ayuda, valor, porDefecto, onCambio,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string | null;
  porDefecto: string;
  onCambio: (v: string | null) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-foreground">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valor ?? porDefecto}
          onChange={(e) => onCambio(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        <span className="text-sm text-muted">{valor ?? "Por defecto"}</span>
        {valor && (
          <button type="button" onClick={() => onCambio(null)} className="text-xs font-medium text-primary hover:underline">
            Restablecer
          </button>
        )}
      </div>
      <span className="mt-1 block text-xs text-muted">{ayuda}</span>
    </div>
  );
}

function SelectorImagen({
  etiqueta, ayuda, valor, fondoOscuro = false, onCambio, onError,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string | null;
  fondoOscuro?: boolean;
  onCambio: (v: string | null) => void;
  onError: (mensaje: string | null) => void;
}) {
  const archivo = useRef<HTMLInputElement>(null);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > IMAGEN_MAX_BYTES) {
      onError(`${etiqueta}: la imagen pesa demasiado. Usa una de menos de 300 KB.`);
      return;
    }
    onError(null);
    const lector = new FileReader();
    lector.onload = () => onCambio(String(lector.result));
    lector.readAsDataURL(file);
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-foreground">{etiqueta}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-14 items-center justify-center rounded-xl px-3 ${fondoOscuro ? "min-w-40 bg-navy-dark" : "w-14 border border-border bg-card"}`}>
          {valor
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de un data URL
            ? <img src={valor} alt={etiqueta} className="max-h-9 w-auto object-contain" />
            : <span className={`text-xs ${fondoOscuro ? "text-white/40" : "text-muted"}`}>—</span>}
        </div>
        <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" onChange={elegir} className="hidden" />
        <button type="button" onClick={() => archivo.current?.click()} className="btn-outline px-3 py-2 text-xs">
          <ImagePlus size={14} /> {valor ? "Cambiar" : "Subir"}
        </button>
        {valor && (
          <button type="button" onClick={() => onCambio(null)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-red-600">
            <Trash2 size={13} /> Quitar
          </button>
        )}
      </div>
      <span className="mt-1.5 block text-xs text-muted">{ayuda} PNG, JPG o WebP de hasta 300 KB.</span>
    </div>
  );
}
