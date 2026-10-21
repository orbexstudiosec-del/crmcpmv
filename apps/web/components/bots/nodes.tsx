"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Play, MessageSquare, HelpCircle, GitBranch, Zap, StopCircle,
  Image as ImageIcon, FileText, MousePointerClick, Clock, CalendarClock, AlertTriangle, type LucideIcon,
} from "lucide-react";
import type { NodeTipo } from "@totalcrm/shared";
import { validarNodo, DIAS_SEMANA } from "@/lib/bots";

const cardBase = "relative w-[210px] rounded-xl border bg-card px-3 py-2 text-xs shadow-sm transition";
const cardSelected = "ring-2 ring-primary border-primary/40";
const cardDefault = "border-border hover:border-primary/40";
const handleStyle = { width: 10, height: 10, borderWidth: 2 };

type Tono = "default" | "success" | "warning" | "destructive" | "media" | "interactive";

function NodeCard({
  icon: Icon, label, summary, selected, tono = "default", type, data,
}: {
  icon: LucideIcon; label: string; summary: string; selected?: boolean; tono?: Tono;
  type: NodeTipo; data: Record<string, unknown>;
}) {
  const toneClass =
    tono === "success" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
    tono === "warning" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
    tono === "destructive" ? "bg-red-500/15 text-red-700 dark:text-red-400" :
    tono === "media" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
    tono === "interactive" ? "bg-sky-500/15 text-sky-700 dark:text-sky-400" :
    "bg-primary-soft text-primary";

  const error = validarNodo(type, data);

  return (
    <div className={`${cardBase} ${selected ? cardSelected : cardDefault} ${error ? "border-red-500/50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">{label}</div>
          <div className="truncate text-[10px] text-muted">{summary || "—"}</div>
        </div>
      </div>
      {error && (
        <div
          className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md"
          title={error}
        >
          <AlertTriangle size={9} />
        </div>
      )}
    </div>
  );
}

export function TriggerNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { triggerType?: string; keywords?: string[] };
  const summary = d.triggerType === "keyword"
    ? (d.keywords ?? []).length > 0 ? `Keywords: ${(d.keywords ?? []).slice(0, 2).join(", ")}` : "Sin keywords aún"
    : "Al primer mensaje";
  return (
    <>
      <NodeCard icon={Play} label="Inicio" summary={summary} selected={selected} tono="success" type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function SendMessageNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { text?: string; mediaKind?: "image" | "document" };
  const prefix = d.mediaKind === "image" ? "🖼️ " : d.mediaKind === "document" ? "📎 " : "";
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard
        icon={MessageSquare} label="Mensaje"
        summary={`${prefix}${d.text || (d.mediaKind ? "Sin texto" : "Mensaje vacío")}`}
        selected={selected} type={type as NodeTipo} data={data ?? {}}
      />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function SendImageNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { imageUrl?: string; caption?: string };
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard
        icon={ImageIcon} label="Imagen" summary={d.imageUrl ? d.caption || "Imagen" : "Sin imagen"}
        selected={selected} tono="media" type={type as NodeTipo} data={data ?? {}}
      />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function SendDocumentNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { documentUrl?: string; filename?: string; caption?: string };
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard
        icon={FileText} label="Archivo" summary={d.documentUrl ? d.filename || d.caption || "Documento" : "Sin archivo"}
        selected={selected} tono="media" type={type as NodeTipo} data={data ?? {}}
      />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

/** Botones: hasta 10 + un fallback. Cada uno es un sourceHandle separado (btn1, btn2… + fallback). */
export function ButtonsNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { text?: string; buttons?: Array<{ id: string; title: string; isBack?: boolean }> };
  const buttons = d.buttons ?? [];
  const validCount = buttons.filter((b) => b.title?.trim()).length;
  const summary = d.text ? `${d.text.slice(0, 30)}${d.text.length > 30 ? "…" : ""}` : "Sin texto";

  const handleSpacing = 22;
  const handlesTop = 60;

  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className={`${cardBase} pb-1 ${selected ? cardSelected : cardDefault}`}
        style={{ minHeight: 70 + buttons.length * handleSpacing }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-400">
            <MousePointerClick size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-foreground">Botones</div>
            <div className="truncate text-[10px] text-muted">{summary} · {validCount}/{buttons.length || 0}</div>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {buttons.map((b, i) => (
            <div
              key={b.id || i}
              className={`flex items-center gap-1.5 truncate rounded-md border px-2 py-1 text-[10px] ${
                b.isBack ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
              }`}
              title={b.isBack ? "Vuelve al menú anterior (no usa edge)" : undefined}
            >
              <span className="font-bold opacity-60">{b.isBack ? "↩" : i + 1}</span>
              <span className="truncate">{b.title || "Sin texto"}</span>
            </div>
          ))}
          {buttons.length === 0 && <div className="px-1 text-[10px] italic text-muted">Edita para agregar botones</div>}
        </div>
        {validarNodo(type as NodeTipo, data ?? {}) && (
          <div className="absolute -right-2 -top-2 inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
            <AlertTriangle size={9} />
          </div>
        )}
      </div>

      {buttons.map((b, i) => (
        <Handle
          key={`btn${i + 1}`}
          type="source"
          position={Position.Right}
          id={`btn${i + 1}`}
          style={{ ...handleStyle, top: handlesTop + i * handleSpacing, background: b.isBack ? "#f59e0b" : "#0ea5e9" }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="fallback"
        style={{ ...handleStyle, top: handlesTop + buttons.length * handleSpacing, background: "#94a3b8" }}
      />
      {buttons.map((b, i) => (
        <span
          key={`lbl${i}`}
          className={`absolute right-3 select-none text-[8px] font-bold ${b.isBack ? "text-amber-600" : "text-sky-600"}`}
          style={{ top: handlesTop - 6 + i * handleSpacing }}
        >
          {b.isBack ? "↩" : `B${i + 1}`}
        </span>
      ))}
      <span className="absolute right-3 select-none text-[8px] font-bold text-muted" style={{ top: handlesTop - 6 + buttons.length * handleSpacing }}>
        otro
      </span>
    </>
  );
}

export function DelayNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { seconds?: number };
  const s = Number(d.seconds) || 0;
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={Clock} label="Esperar" summary={s > 0 ? `Espera ${s}s` : "Tiempo no definido"} selected={selected} tono="warning" type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function AskInputNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { question?: string; saveAs?: string; validation?: string };
  const summary = d.question ? `${d.question.slice(0, 22)}${d.question.length > 22 ? "…" : ""} → ${d.saveAs || "?"}` : "Pregunta vacía";
  const suffix = d.validation && d.validation !== "any" ? ` (${d.validation})` : "";
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={HelpCircle} label="Preguntar" summary={summary + suffix} selected={selected} type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function ConditionNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { variable?: string; operator?: string; value?: string };
  const opLabel = d.operator === "exists" ? "tiene valor" : d.operator === "contains" ? `contiene "${d.value ?? ""}"` : `= "${d.value ?? ""}"`;
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={GitBranch} label="Condición" summary={d.variable ? `${d.variable} ${opLabel}` : "Sin condición"} selected={selected} tono="warning" type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} id="yes" style={{ ...handleStyle, top: "30%", background: "#10b981" }} />
      <Handle type="source" position={Position.Right} id="no" style={{ ...handleStyle, top: "70%", background: "#ef4444" }} />
      <span className="absolute right-3 top-[20%] select-none text-[9px] font-bold text-emerald-600">Sí</span>
      <span className="absolute right-3 top-[60%] select-none text-[9px] font-bold text-red-600">No</span>
    </>
  );
}

export function ActionNode({ data, selected, type }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={Zap} label="Acción" summary="Pasar a humano" selected={selected} type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function ScheduleBookingNode({ data, selected, type }: NodeProps) {
  const d = (data ?? {}) as { titulo?: string; duracionMinutos?: number; dias?: string[]; horaInicio?: string; horaFin?: string };
  const dias = d.dias ?? [];
  const diasResumen = dias.length === 7 ? "Todos los días" : dias.length === 0 ? "Sin días" : DIAS_SEMANA.filter((x) => dias.includes(x.v)).map((x) => x.l).join(" ");
  const summary = `${d.titulo || "Cita"} · ${d.duracionMinutos ?? 30} min · ${diasResumen} · ${d.horaInicio ?? "?"}-${d.horaFin ?? "?"}`;
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={CalendarClock} label="Agendar cita" summary={summary} selected={selected} tono="interactive" type={type as NodeTipo} data={data ?? {}} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  );
}

export function EndNode({ selected, type, data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <NodeCard icon={StopCircle} label="Fin" summary="Termina el flujo" selected={selected} tono="destructive" type={type as NodeTipo} data={data ?? {}} />
    </>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  sendImage: SendImageNode,
  sendDocument: SendDocumentNode,
  buttons: ButtonsNode,
  delay: DelayNode,
  askInput: AskInputNode,
  condition: ConditionNode,
  action: ActionNode,
  scheduleBooking: ScheduleBookingNode,
  end: EndNode,
};
