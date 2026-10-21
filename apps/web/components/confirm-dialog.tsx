"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface Pedido {
  mensaje: string;
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligroso?: boolean; // default true (icono/botón rojo). false = tono neutro.
  resolver: (ok: boolean) => void;
}

let despachar: ((p: Pedido) => void) | null = null;

/** Reemplazo de `window.confirm` con el estilo visual de la app — se usa igual
 * (`if (!(await confirmDialog("¿Eliminar X?"))) return;`) pero es asíncrono.
 * Requiere que <ConfirmDialogHost/> esté montado (ya vive en el layout raíz); si por
 * algún motivo no lo está, cae de vuelta al confirm() nativo del navegador. */
export function confirmDialog(
  mensaje: string,
  opciones: { titulo?: string; textoConfirmar?: string; textoCancelar?: string; peligroso?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!despachar) { resolve(window.confirm(mensaje)); return; }
    despachar({ mensaje, resolver: resolve, ...opciones });
  });
}

export function ConfirmDialogHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    despachar = setPedido;
    return () => { despachar = null; };
  }, []);

  useEffect(() => {
    if (!pedido) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  function cerrar(ok: boolean) {
    pedido?.resolver(ok);
    setPedido(null);
  }

  if (!pedido) return null;
  const peligroso = pedido.peligroso !== false;
  const Icono = peligroso ? AlertTriangle : HelpCircle;

  return (
    <div
      role="presentation"
      onClick={() => cerrar(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titulo"
        className="card w-full max-w-sm p-5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              peligroso ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-primary-soft text-primary"
            }`}
          >
            <Icono size={18} />
          </span>
          <div className="min-w-0 pt-1">
            <p id="confirm-dialog-titulo" className="text-sm font-semibold text-foreground">
              {pedido.titulo ?? "Confirmar acción"}
            </p>
            <p className="mt-1 text-sm text-muted">{pedido.mensaje}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button autoFocus onClick={() => cerrar(false)} className="btn-outline px-3 py-2 text-sm">
            {pedido.textoCancelar ?? "Cancelar"}
          </button>
          <button
            onClick={() => cerrar(true)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${
              peligroso ? "bg-red-600 hover:bg-red-700" : "btn-primary"
            }`}
          >
            {pedido.textoConfirmar ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
