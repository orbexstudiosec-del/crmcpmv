"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X, Plus, Copy as CopyIcon, Undo2 } from "lucide-react";
import type { NodeTipo } from "@totalcrm/shared";
import { api } from "@/lib/api";
import { confirmDialog } from "@/components/confirm-dialog";
import { NODE_LABELS, DIAS_SEMANA } from "@/lib/bots";

interface Departamento { id: string; nombre: string }

type Props = {
  selectedNode: { id: string; type: NodeTipo; data: Record<string, unknown> } | null;
  /** Variables `vars.<nombre>` de nodos askInput anteriores del flujo, para insertarlas como chips. */
  flowVariables?: string[];
  onChange: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
};

export function PropertiesPanel({ selectedNode, flowVariables = [], onChange, onDelete, onDuplicate, onClose }: Props) {
  if (!selectedNode) {
    return (
      <div className="h-full p-6 text-center text-xs text-muted">
        <div className="rounded-2xl border border-dashed border-border p-6">
          <p className="font-medium text-foreground/80">Sin nodo seleccionado</p>
          <p className="mt-1 text-muted">Toca un nodo del canvas para editar sus propiedades aquí.</p>
        </div>
      </div>
    );
  }

  const update = (d: Record<string, unknown>) => onChange(selectedNode.id, d);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted">Nodo</div>
          <div className="truncate text-sm font-semibold text-foreground">{NODE_LABELS[selectedNode.type]}</div>
        </div>
        <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground" aria-label="Cerrar panel">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {selectedNode.type === "trigger" && <TriggerEditor data={selectedNode.data} onChange={update} />}
        {selectedNode.type === "sendMessage" && <SendMessageEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "sendImage" && <SendImageEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "sendDocument" && <SendDocumentEditor data={selectedNode.data} onChange={update} />}
        {selectedNode.type === "buttons" && <ButtonsEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "delay" && <DelayEditor data={selectedNode.data} onChange={update} />}
        {selectedNode.type === "askInput" && <AskInputEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "condition" && <ConditionEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "action" && <ActionEditor data={selectedNode.data} flowVariables={flowVariables} onChange={update} />}
        {selectedNode.type === "scheduleBooking" && <ScheduleBookingEditor data={selectedNode.data} onChange={update} />}
        {selectedNode.type === "end" && (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">Este nodo termina el flujo. No tiene configuración.</p>
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {selectedNode.type !== "trigger" && selectedNode.type !== "end" && (
          <button onClick={() => onDuplicate(selectedNode.id)} className="btn-outline flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-xs">
            <CopyIcon size={12} /> Duplicar
          </button>
        )}
        {selectedNode.type !== "trigger" && (
          <DeleteNodeButton onConfirm={() => onDelete(selectedNode.id)} nodeLabel={NODE_LABELS[selectedNode.type]} />
        )}
      </div>
    </div>
  );
}

// ============== Piezas base ==============

function Field({ label, hint, action, children }: { label: string; hint?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-foreground/80">{label}</label>
        {action}
      </div>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-primary";

// ============== Editores por tipo de nodo ==============

function TriggerEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const triggerType = (data.triggerType as string) ?? "first_message";
  const keywords = (data.keywords as string[]) ?? [];
  return (
    <div className="space-y-3">
      <Field label="Disparador" hint={triggerType === "first_message" ? "Solo arranca en el primer mensaje del cliente." : "Arranca cuando el cliente escribe alguna de las palabras (sin importar mayúsculas)."}>
        <select value={triggerType} onChange={(e) => onChange({ ...data, triggerType: e.target.value })} className={inputCls}>
          <option value="first_message">Al primer mensaje del cliente</option>
          <option value="keyword">Cuando contiene palabra clave</option>
        </select>
      </Field>
      {triggerType === "keyword" && (
        <Field label="Palabras clave" hint="Sepáralas con coma. Ej: hola, info, precio">
          <input
            type="text"
            value={keywords.join(", ")}
            onChange={(e) => onChange({ ...data, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
            placeholder="hola, info, precio"
            className={inputCls}
          />
        </Field>
      )}
    </div>
  );
}

function SendMessageEditor({ data, flowVariables, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const mediaKind = data.mediaKind as string | undefined;
  return (
    <div className="space-y-3">
      <Field label="Texto del mensaje">
        <textarea ref={textRef} rows={6} value={(data.text as string) ?? ""} onChange={(e) => onChange({ ...data, text: e.target.value })} placeholder="Hola, ¿cómo te ayudamos?" className={`${inputCls} resize-y`} />
      </Field>
      <VariableChips targetRef={textRef} value={(data.text as string) ?? ""} flowVariables={flowVariables} onChange={(v) => onChange({ ...data, text: v })} />

      {!mediaKind && (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onChange({ ...data, mediaKind: "image", mediaUrl: "" })} className="flex-1 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs font-medium text-muted transition hover:border-primary hover:text-primary">
            Adjuntar imagen
          </button>
          <button type="button" onClick={() => onChange({ ...data, mediaKind: "document", mediaUrl: "", filename: "" })} className="flex-1 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs font-medium text-muted transition hover:border-primary hover:text-primary">
            Adjuntar archivo
          </button>
        </div>
      )}

      {mediaKind && (
        <Field
          label={mediaKind === "image" ? "URL de la imagen" : "URL del archivo"}
          hint="El texto de arriba se envía como caption del adjunto."
          action={<button type="button" onClick={() => onChange({ ...data, mediaKind: undefined, mediaUrl: undefined, filename: undefined })} className="text-[10px] text-red-600 hover:underline">Quitar</button>}
        >
          <input type="url" value={(data.mediaUrl as string) ?? ""} onChange={(e) => onChange({ ...data, mediaUrl: e.target.value })} placeholder="https://…" className={inputCls} />
        </Field>
      )}
    </div>
  );
}

function SendImageEditor({ data, flowVariables, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const captionRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-3">
      <Field label="URL de la imagen" hint="Debe ser una URL pública accesible.">
        <input type="url" value={(data.imageUrl as string) ?? ""} onChange={(e) => onChange({ ...data, imageUrl: e.target.value })} placeholder="https://…" className={inputCls} />
      </Field>
      <Field label="Caption (opcional)">
        <textarea ref={captionRef} rows={2} value={(data.caption as string) ?? ""} onChange={(e) => onChange({ ...data, caption: e.target.value })} placeholder="Texto debajo de la imagen" className={`${inputCls} resize-y`} />
      </Field>
      <VariableChips targetRef={captionRef} value={(data.caption as string) ?? ""} flowVariables={flowVariables} onChange={(v) => onChange({ ...data, caption: v })} />
    </div>
  );
}

function SendDocumentEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="URL del archivo" hint="Debe ser una URL pública accesible.">
        <input type="url" value={(data.documentUrl as string) ?? ""} onChange={(e) => onChange({ ...data, documentUrl: e.target.value })} placeholder="https://…" className={inputCls} />
      </Field>
      <Field label="Nombre visible (opcional)" hint="Cómo aparece en el chat del cliente.">
        <input type="text" value={(data.filename as string) ?? ""} onChange={(e) => onChange({ ...data, filename: e.target.value })} placeholder="catalogo-2026.pdf" className={inputCls} />
      </Field>
      <Field label="Caption (opcional)">
        <textarea rows={2} value={(data.caption as string) ?? ""} onChange={(e) => onChange({ ...data, caption: e.target.value })} placeholder="Texto debajo del archivo" className={`${inputCls} resize-y`} />
      </Field>
    </div>
  );
}

function ButtonsEditor({ data, flowVariables, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const buttons = (data.buttons as Array<{ id: string; title: string; isBack?: boolean }>) ?? [];
  const maxButtons = 10;

  function updateButton(idx: number, patch: Partial<{ title: string; isBack: boolean }>) {
    onChange({ ...data, buttons: buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)) });
  }
  function addButton() {
    if (buttons.length >= maxButtons) return;
    onChange({ ...data, buttons: [...buttons, { id: `b${Date.now().toString(36).slice(-4)}`, title: "" }] });
  }
  function addBackButton() {
    if (buttons.length >= maxButtons) return;
    onChange({ ...data, buttons: [...buttons, { id: `back${Date.now().toString(36).slice(-4)}`, title: "⬅ Volver", isBack: true }] });
  }
  function removeButton(idx: number) {
    onChange({ ...data, buttons: buttons.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <Field label="Mensaje del cliente" hint="Aparece arriba de los botones.">
        <textarea ref={textRef} rows={3} value={(data.text as string) ?? ""} onChange={(e) => onChange({ ...data, text: e.target.value })} placeholder="¿Qué te gustaría hacer?" className={`${inputCls} resize-y`} />
      </Field>
      <VariableChips targetRef={textRef} value={(data.text as string) ?? ""} flowVariables={flowVariables} onChange={(v) => onChange({ ...data, text: v })} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11px] font-semibold text-foreground/80">Opciones ({buttons.length}/{maxButtons})</label>
          <div className="flex items-center gap-1">
            <button type="button" onClick={addBackButton} disabled={buttons.length >= maxButtons} className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400">
              <Undo2 size={10} /> Volver
            </button>
            <button type="button" onClick={addButton} disabled={buttons.length >= maxButtons} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50">
              <Plus size={10} /> Agregar
            </button>
          </div>
        </div>
        {buttons.length === 0 ? (
          <p className="px-1 text-[10px] italic text-muted">Agrega hasta 10 opciones — se envían como botones o lista, según el canal.</p>
        ) : (
          <ul className="space-y-2">
            {buttons.map((b, idx) => (
              <li key={b.id || idx} className={`space-y-1 rounded-lg border bg-card p-2 ${b.isBack ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
                <div className="flex items-center gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${b.isBack ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-sky-500/15 text-sky-600"}`}>
                    {b.isBack ? <Undo2 size={9} className="inline" /> : `B${idx + 1}`}
                  </span>
                  <input type="text" value={b.title} onChange={(e) => updateButton(idx, { title: e.target.value })} placeholder="Texto del botón" maxLength={20} className={`${inputCls} flex-1 text-xs`} />
                  <button type="button" onClick={() => removeButton(idx)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted transition hover:text-red-600" aria-label="Eliminar botón">
                    <Trash2 size={11} />
                  </button>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 pl-6 text-[10px] text-muted">
                  <input type="checkbox" checked={!!b.isBack} onChange={(e) => updateButton(idx, { isBack: e.target.checked })} className="h-3 w-3 rounded border-border text-amber-500" />
                  <span>Volver al menú anterior <span className="text-muted/70">(no usa edge)</span></span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted">
          Cada botón sale por una rama distinta. La rama <strong>otro</strong> se usa si el cliente escribe algo que no coincide con ningún botón.
        </p>
      </div>
    </div>
  );
}

function DelayEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const seconds = Number(data.seconds) || 1;
  return (
    <Field label="Tiempo de espera" hint="Para simular que estás escribiendo. Máximo 60 segundos.">
      <div className="flex items-center gap-2">
        <input type="range" min={1} max={60} value={seconds} onChange={(e) => onChange({ ...data, seconds: Number(e.target.value) })} className="flex-1 accent-primary" />
        <input type="number" min={1} max={60} value={seconds} onChange={(e) => onChange({ ...data, seconds: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} className={`${inputCls} w-16`} />
        <span className="text-xs text-muted">s</span>
      </div>
    </Field>
  );
}

function AskInputEditor({ data, flowVariables, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const validation = (data.validation as string) ?? "any";
  const questionRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-3">
      <Field label="Pregunta">
        <textarea ref={questionRef} rows={3} value={(data.question as string) ?? ""} onChange={(e) => onChange({ ...data, question: e.target.value })} placeholder="¿Cuál es tu correo?" className={`${inputCls} resize-y`} />
      </Field>
      <VariableChips targetRef={questionRef} value={(data.question as string) ?? ""} flowVariables={flowVariables} onChange={(v) => onChange({ ...data, question: v })} />
      <Field label="Guardar como variable" hint={<>La usas después como <code className="rounded bg-muted/15 px-1 font-mono">{`{{vars.${(data.saveAs as string) || "nombre"}}}`}</code></>}>
        <input type="text" value={(data.saveAs as string) ?? ""} onChange={(e) => onChange({ ...data, saveAs: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="email" className={`${inputCls} font-mono`} />
      </Field>
      <Field label="Validar respuesta" hint={validation === "any" ? "Acepta cualquier texto." : "Si la respuesta no cumple, el bot vuelve a preguntar."}>
        <select value={validation} onChange={(e) => onChange({ ...data, validation: e.target.value })} className={inputCls}>
          <option value="any">Cualquier texto</option>
          <option value="email">Email</option>
          <option value="phone">Teléfono</option>
          <option value="number">Número</option>
        </select>
      </Field>
      {validation !== "any" && (
        <Field label="Mensaje de re-pregunta (opcional)" hint="Lo que el bot responde si la validación falla.">
          <input type="text" value={(data.retryMessage as string) ?? ""} onChange={(e) => onChange({ ...data, retryMessage: e.target.value })} placeholder="Eso no parece válido. ¿Lo intentas de nuevo?" className={inputCls} />
        </Field>
      )}
    </div>
  );
}

function ConditionEditor({ data, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const op = (data.operator as string) ?? "equals";
  return (
    <div className="space-y-3">
      <Field label="Variable a evaluar" hint={<>Solo variables capturadas en este flujo (<code className="font-mono">vars.</code> + nombre).</>}>
        <input type="text" value={(data.variable as string) ?? ""} onChange={(e) => onChange({ ...data, variable: e.target.value })} placeholder="vars.nombre" className={`${inputCls} font-mono`} />
      </Field>
      <Field label="Operador">
        <select value={op} onChange={(e) => onChange({ ...data, operator: e.target.value })} className={inputCls}>
          <option value="equals">Es igual a</option>
          <option value="contains">Contiene</option>
          <option value="exists">Tiene cualquier valor</option>
        </select>
      </Field>
      {op !== "exists" && (
        <Field label="Valor" hint="Comparación sin distinguir mayúsculas.">
          <input type="text" value={(data.value as string) ?? ""} onChange={(e) => onChange({ ...data, value: e.target.value })} placeholder="si" className={inputCls} />
        </Field>
      )}
      <div className="rounded-lg border border-dashed border-border bg-surface/50 p-2.5 text-[11px] text-muted">
        Las dos salidas son <span className="font-semibold text-emerald-600">Sí</span> y <span className="font-semibold text-red-600">No</span>.
      </div>
    </div>
  );
}

function ActionEditor({ data, flowVariables, onChange }: { data: Record<string, unknown>; flowVariables?: string[]; onChange: (d: Record<string, unknown>) => void }) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const handoffRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<Departamento[]>("/departamentos").then(setDepartamentos).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted">
        Este nodo pasa la conversación a un humano. El bot se pausa hasta que alguien del equipo responda.
      </p>
      <Field
        label="Asignar a departamento (opcional)"
        hint={departamentos.length === 0 ? "No tienes departamentos creados. Ve a Equipo → Departamentos." : "El chat queda filtrado por área en el inbox de Mensajes."}
      >
        <select value={(data.departmentId as string) ?? ""} onChange={(e) => onChange({ ...data, departmentId: e.target.value || undefined })} className={inputCls}>
          <option value="">— Sin asignar —</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </Field>
      <Field label="Mensaje al cliente (opcional)" hint="El bot lo envía antes de pausar. Vacío = pausa silenciosa.">
        <textarea ref={handoffRef} rows={3} value={(data.handoffMessage as string) ?? ""} onChange={(e) => onChange({ ...data, handoffMessage: e.target.value })} placeholder="Listo, te paso con un asesor. En breve te contactamos." className={`${inputCls} resize-y`} />
      </Field>
      <VariableChips targetRef={handoffRef} value={(data.handoffMessage as string) ?? ""} flowVariables={flowVariables} onChange={(v) => onChange({ ...data, handoffMessage: v })} />
      <Field label="Avisar por WhatsApp a este número (opcional)" hint="Manda un aviso a este número (ej. tu celular) por la misma cuenta conectada.">
        <input type="text" inputMode="tel" value={(data.notifyPhone as string) ?? ""} onChange={(e) => onChange({ ...data, notifyPhone: e.target.value || undefined })} placeholder="+593987654321" className={`${inputCls} font-mono tabular-nums`} />
      </Field>
    </div>
  );
}

function ScheduleBookingEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const dias = (data.dias as string[]) ?? [];
  const duracion = Number(data.duracionMinutos) || 30;

  function toggleDia(v: string) {
    onChange({ ...data, dias: dias.includes(v) ? dias.filter((d) => d !== v) : [...dias, v] });
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted">
        El horario de disponibilidad se configura aquí, en el propio nodo. Este nodo todavía no agenda en vivo.
      </p>
      <Field label="Título de la cita">
        <input
          type="text" value={(data.titulo as string) ?? ""} onChange={(e) => onChange({ ...data, titulo: e.target.value })}
          placeholder="Cita" className={inputCls}
        />
      </Field>
      <Field label="Duración de cada cita">
        <select value={duracion} onChange={(e) => onChange({ ...data, duracionMinutos: Number(e.target.value) })} className={inputCls}>
          {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </Field>
      <Field label="Días disponibles">
        <div className="flex gap-1">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.v} type="button" onClick={() => toggleDia(d.v)}
              className={`h-7 w-7 rounded-md text-xs font-semibold transition ${
                dias.includes(d.v) ? "bg-primary text-white" : "bg-card text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              {d.l}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Desde">
          <input
            type="time" value={(data.horaInicio as string) ?? "09:00"} onChange={(e) => onChange({ ...data, horaInicio: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Hasta">
          <input
            type="time" value={(data.horaFin as string) ?? "18:00"} onChange={(e) => onChange({ ...data, horaFin: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Mensaje de confirmación (opcional)" hint="Lo que el bot dice después de agendar.">
        <textarea
          rows={2} value={(data.mensajeConfirmacion as string) ?? ""} onChange={(e) => onChange({ ...data, mensajeConfirmacion: e.target.value })}
          placeholder="¡Listo! Te esperamos." className={`${inputCls} resize-y`}
        />
      </Field>
    </div>
  );
}

// ============== Sub-componentes ==============

function VariableChips({
  targetRef, value, flowVariables = [], onChange,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  flowVariables?: string[];
  onChange: (v: string) => void;
}) {
  function insert(token: string) {
    const el = targetRef.current;
    if (!el) {
      onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const contactChips = [
    { label: "Nombre", token: "{{contact.firstName}}" },
    { label: "Nombre completo", token: "{{contact.name}}" },
    { label: "Email", token: "{{contact.email}}" },
    { label: "Teléfono", token: "{{contact.phone}}" },
  ];

  return (
    <div className="mt-1 space-y-2 rounded-lg border border-dashed border-border bg-surface/50 p-2">
      <div>
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted">Insertar dato del cliente</div>
        <div className="flex flex-wrap gap-1">
          {contactChips.map((c) => (
            <button key={c.token} type="button" onClick={() => insert(c.token)} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary transition hover:bg-primary hover:text-white">
              + {c.label}
            </button>
          ))}
        </div>
      </div>
      {flowVariables.length > 0 && (
        <div className="border-t border-border/60 pt-1.5">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted">Variables del flujo</div>
          <div className="flex flex-wrap gap-1">
            {flowVariables.map((name) => (
              <button key={name} type="button" onClick={() => insert(`{{vars.${name}}}`)} title={`Valor guardado en "${name}" por un nodo Preguntar anterior`} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-500 hover:text-white dark:text-emerald-400">
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteNodeButton({ onConfirm, nodeLabel }: { onConfirm: () => void; nodeLabel: string }) {
  async function handleClick() {
    if (await confirmDialog(`El nodo "${nodeLabel}" se va a quitar del flujo. Las conexiones que lo apuntaban quedan rotas.`, { titulo: "¿Eliminar nodo?", textoConfirmar: "Eliminar" })) {
      onConfirm();
    }
  }
  return (
    <button onClick={handleClick} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-400">
      <Trash2 size={12} /> Eliminar nodo
    </button>
  );
}
