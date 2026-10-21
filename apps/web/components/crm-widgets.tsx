"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Table2, ChartColumn } from "lucide-react";
import type { Tendencia } from "@/lib/crm";

export function EmptyState({ texto }: { texto: string }) {
  return <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">{texto}</p>;
}

export function Kpi({
  icon: Icon, titulo, valor, tendencia, color,
}: { icon: LucideIcon; titulo: string; valor: number | string; tendencia: Tendencia; color: string }) {
  return (
    <div className="card p-4">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
      >
        <Icon size={15} />
      </span>
      <p className="mt-2.5 text-xs text-muted">{titulo}</p>
      <p className="mt-0.5 font-display text-xl font-bold tracking-tight text-foreground">{valor}</p>
      {tendencia && (
        <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${tendencia.subio ? "text-emerald-600" : "text-red-500"}`}>
          {tendencia.subio ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {tendencia.pct}{tendencia.sufijo === "pts" ? " pts" : "%"}
          <span className="font-normal text-muted">vs. sem. anterior</span>
        </p>
      )}
    </div>
  );
}

/** Botón chico para alternar entre el gráfico y su tabla equivalente — la vía de acceso a
 * cada valor sin depender de pasar el mouse (accesibilidad: WCAG-clean twin de cada gráfico). */
function ToggleTabla({ activa, onToggle }: { activa: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted transition hover:bg-surface hover:text-foreground"
    >
      {activa ? <ChartColumn size={12} /> : <Table2 size={12} />}
      {activa ? "Gráfico" : "Tabla"}
    </button>
  );
}

/** Dona SVG + número central + leyenda interactiva. Pasar el mouse (o enfocar con teclado)
 * una fila de la leyenda resalta su arco y muestra el valor real en un tooltip — antes solo
 * había un `<title>` nativo del navegador, sin estilo y sin acceso por teclado. */
export function DonutCard({ titulo, data, formato }: { titulo: string; data: { label: string; value: number; color: string }[]; formato: (v: number) => string }) {
  const [tabla, setTabla] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 120, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  const segmentos: { label: string; color: string; value: number; dash: number; offset: number }[] = [];
  for (let i = 0, offset = 0; i < data.length; i++) {
    const d = data[i];
    const frac = total > 0 ? d.value / total : 0;
    segmentos.push({ label: d.label, color: d.color, value: d.value, dash: Math.max(0, frac * c - 2), offset });
    offset += frac * c;
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-foreground">{titulo}</h2>
        {data.length > 0 && <ToggleTabla activa={tabla} onToggle={() => setTabla((v) => !v)} />}
      </div>

      {data.length === 0 ? null : tabla ? (
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="pb-1.5 font-medium">Categoría</th>
              <th className="pb-1.5 text-right font-medium">Valor</th>
              <th className="pb-1.5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5 text-foreground">
                  <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ backgroundColor: d.color }} />
                  {d.label}
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{formato(d.value)}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
              {segmentos.map((seg) => (
                <circle
                  key={seg.label}
                  cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={seg.color}
                  strokeWidth={activo === seg.label ? stroke + 3 : stroke}
                  strokeDasharray={`${seg.dash} ${c - seg.dash}`}
                  strokeDashoffset={-seg.offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-width 120ms ease", cursor: "pointer" }}
                  tabIndex={0}
                  onMouseEnter={() => setActivo(seg.label)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(seg.label)}
                  onBlur={() => setActivo(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-lg font-bold text-foreground">{total > 0 ? formato(total) : "0"}</span>
              <span className="text-[10px] text-muted">Total</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((d) => (
              <li key={d.label}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs outline-none transition hover:bg-surface focus-visible:bg-surface"
                  onMouseEnter={() => setActivo(d.label)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(d.label)}
                  onBlur={() => setActivo(null)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted">{d.label}</span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium text-foreground">{formato(d.value)}</span>
                    <span className="block text-[10px] text-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Barras verticales. `valorFondo` (opcional) dibuja una barra clara de fondo — útil para
 * mostrar un total junto a un subconjunto (ej. creadas vs. ganadas, cartera vs. mora). Cuando
 * hay dos series (valorFondo presente) exige `leyenda` — con dos series, un color solo no
 * alcanza como canal de identidad. Cada barra es un botón enfocable con teclado y responde
 * al hover/foco (se aclara) aunque el valor ya vive siempre visible debajo, sin gate. */
export function BarChart({
  data, formato, color, leyenda,
}: {
  data: { label: string; value: number; valorFondo?: number }[];
  formato: (v: number) => string;
  color: string;
  leyenda?: { value: string; valorFondo: string };
}) {
  const [tabla, setTabla] = useState(false);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.valorFondo ?? 0)));
  const dosSeries = data.some((d) => d.valorFondo !== undefined);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {dosSeries && leyenda ? (
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{leyenda.value}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full opacity-25" style={{ backgroundColor: color }} />{leyenda.valorFondo}</span>
          </div>
        ) : <span />}
        <ToggleTabla activa={tabla} onToggle={() => setTabla((v) => !v)} />
      </div>

      {tabla ? (
        <table className="w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="pb-1.5 font-medium">{dosSeries ? "" : "Categoría"}</th>
              {dosSeries && leyenda ? (
                <>
                  <th className="pb-1.5 text-right font-medium">{leyenda.valorFondo}</th>
                  <th className="pb-1.5 text-right font-medium">{leyenda.value}</th>
                </>
              ) : (
                <th className="pb-1.5 text-right font-medium">Valor</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5 text-foreground">{d.label}</td>
                {dosSeries && (
                  <td className="py-1.5 text-right tabular-nums text-muted">{d.valorFondo !== undefined ? formato(d.valorFondo) : "—"}</td>
                )}
                <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{formato(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex h-40 items-end gap-2.5">
          {data.map((d) => (
            <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <button
                type="button"
                aria-label={`${d.label}: ${formato(d.value)}`}
                className="relative flex h-32 w-full items-end justify-center overflow-hidden rounded-t-md bg-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {d.valorFondo !== undefined && (
                  <div
                    className="absolute bottom-0 w-full max-w-6 rounded-t-md opacity-25 transition-all"
                    style={{ height: `${Math.max(4, (d.valorFondo / max) * 100)}%`, backgroundColor: color }}
                  />
                )}
                <div
                  className="relative w-full max-w-6 rounded-t-md transition-all group-hover:brightness-110 group-focus-within:brightness-110"
                  style={{ height: `${Math.max(d.value > 0 ? 4 : 0, (d.value / max) * 100)}%`, backgroundColor: color }}
                />
              </button>
              <span className="text-center text-[10px] font-medium leading-tight text-muted">{d.label}</span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{formato(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Embudo tipo trapecio (más ancho arriba) + leyenda con conteo y % sobre el total. Cada
 * etapa es enfocable con teclado y resalta (se aclara) su propio trapecio al pasar el mouse
 * o enfocar — el valor real ya vive siempre en la leyenda, sin depender del hover. */
export function FunnelChart({ data, total }: { data: { v: string; l: string; color: string; count: number }[]; total: number }) {
  const [tabla, setTabla] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((f) => f.count));
  const n = data.length;
  const maxInset = 42;
  const insetAt = (i: number) => (i / n) * maxInset;

  return (
    <div>
      <div className="mb-2 flex justify-end"><ToggleTabla activa={tabla} onToggle={() => setTabla((v) => !v)} /></div>

      {tabla ? (
        <table className="w-full text-left text-xs">
          <thead className="text-muted">
            <tr><th className="pb-1.5 font-medium">Etapa</th><th className="pb-1.5 text-right font-medium">Cantidad</th><th className="pb-1.5 text-right font-medium">%</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((f) => (
              <tr key={f.v}>
                <td className="py-1.5 text-foreground">
                  <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ backgroundColor: f.color }} />
                  {f.l}
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{f.count}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{total > 0 ? Math.round((f.count / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex items-center gap-6">
          <div className="flex shrink-0 flex-col" style={{ width: 170 }}>
            {data.map((f, i) => (
              <button
                type="button"
                key={f.v}
                aria-label={`${f.l}: ${f.count}`}
                className="h-9 w-full outline-none"
                style={{
                  backgroundColor: f.color,
                  clipPath: `polygon(${insetAt(i)}% 0%, ${100 - insetAt(i)}% 0%, ${100 - insetAt(i + 1)}% 100%, ${insetAt(i + 1)}% 100%)`,
                  opacity: activo === f.v ? 1 : 0.35 + 0.65 * (f.count / max),
                  transition: "opacity 120ms ease",
                }}
                onMouseEnter={() => setActivo(f.v)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(f.v)}
                onBlur={() => setActivo(null)}
              />
            ))}
          </div>
          <ul className="min-w-0 flex-1 space-y-3">
            {data.map((f) => (
              <li key={f.v} className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm transition ${activo === f.v ? "bg-surface" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                <span className="min-w-0 flex-1 truncate text-muted">{f.l}</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{f.count}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                  {total > 0 ? Math.round((f.count / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

