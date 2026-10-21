"use client";

export type TipoCampoFormulario = "TEXTO_CORTO" | "TEXTO_LARGO" | "TELEFONO" | "EMAIL" | "OPCION_UNICA" | "OPCION_MULTIPLE";
export type CampoLeadFijo = "EMAIL" | "EMPRESA" | "NOTAS" | "CIUDAD";

export interface CampoFormularioVista {
  id: string;
  tipo: TipoCampoFormulario;
  etiqueta: string;
  obligatorio: boolean;
  opciones: string[];
}

export const INPUT_CLASE = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
export const LABEL_CLASE = "mb-1 block text-sm font-medium text-foreground";

interface Props {
  campo: CampoFormularioVista;
  valor?: string | string[];
  onChange?: (valor: string | string[]) => void;
  /** true = solo visual (previsualización del editor) — no captura texto ni valida de verdad. */
  soloVista?: boolean;
}

/** Un único control de pregunta, usado tanto por el formulario público real
 *  (apps/web/app/f/[slug]/page.tsx) como por la previsualización en vivo del editor
 *  (apps/web/app/formularios/[id]/page.tsx) — así las dos vistas nunca se desincronizan. */
export function CampoFormularioInput({ campo, valor, onChange, soloVista = false }: Props) {
  const marcados = Array.isArray(valor) ? valor : [];
  const texto = typeof valor === "string" ? valor : "";

  return (
    <label className="block">
      <span className={LABEL_CLASE}>
        {campo.etiqueta || "Pregunta sin título"}
        {campo.obligatorio && <span className="text-red-500"> *</span>}
      </span>

      {campo.tipo === "TEXTO_LARGO" ? (
        <textarea disabled={soloVista} required={campo.obligatorio} rows={3} value={texto} onChange={(e) => onChange?.(e.target.value)} className={INPUT_CLASE} />
      ) : campo.tipo === "OPCION_UNICA" ? (
        <div className="space-y-1.5">
          {campo.opciones.length === 0 && <p className="text-xs italic text-muted">Sin opciones todavía…</p>}
          {campo.opciones.map((op, i) => (
            <label key={`${op}-${i}`} className="flex items-center gap-2 text-sm text-foreground">
              <input type="radio" disabled={soloVista} required={campo.obligatorio} name={campo.id} checked={valor === op} onChange={() => onChange?.(op)} className="h-4 w-4 border-border" />
              {op || `Opción ${i + 1}`}
            </label>
          ))}
        </div>
      ) : campo.tipo === "OPCION_MULTIPLE" ? (
        <div className="space-y-1.5">
          {campo.opciones.length === 0 && <p className="text-xs italic text-muted">Sin opciones todavía…</p>}
          {campo.opciones.map((op, i) => (
            <label key={`${op}-${i}`} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                disabled={soloVista}
                checked={marcados.includes(op)}
                onChange={() => onChange?.(marcados.includes(op) ? marcados.filter((o) => o !== op) : [...marcados, op])}
                className="h-4 w-4 rounded border-border"
              />
              {op || `Opción ${i + 1}`}
            </label>
          ))}
        </div>
      ) : (
        <input
          disabled={soloVista}
          required={campo.obligatorio}
          type={campo.tipo === "EMAIL" ? "email" : campo.tipo === "TELEFONO" ? "tel" : "text"}
          value={texto}
          onChange={(e) => onChange?.(e.target.value)}
          className={INPUT_CLASE}
        />
      )}
    </label>
  );
}
