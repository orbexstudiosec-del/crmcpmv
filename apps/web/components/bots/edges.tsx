"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";

/** Edge con botón "X" en el medio que aparece al hover — borrar una conexión con un click,
 *  sin depender de que el usuario descubra "selecciona + Delete". El hover se trackea sobre
 *  un `<path>` invisible más ancho (20px) que envuelve a la línea real de 1.5px, porque
 *  atinarle a una línea tan fina es frustrante. */
export function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const active = hovered || selected;

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: active ? "#6366F1" : (style?.stroke ?? "#94a3b8"), strokeWidth: active ? 2 : (style?.strokeWidth ?? 1.5) }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            setEdges((eds) => eds.filter((edge) => edge.id !== id));
          }}
          className="nodrag nopan pointer-events-auto absolute inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted shadow-sm transition hover:border-red-500/60 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: active ? 1 : 0,
            pointerEvents: active ? "auto" : "none",
          }}
          title="Borrar conexión"
          aria-label="Borrar conexión"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { deletable: DeletableEdge };
