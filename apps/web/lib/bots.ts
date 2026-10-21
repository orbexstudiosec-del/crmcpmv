import type { FlowNode, NodeTipo } from "@totalcrm/shared";

export const NODE_LABELS: Record<NodeTipo, string> = {
  trigger: "Inicio",
  sendMessage: "Mensaje",
  sendImage: "Imagen",
  sendDocument: "Archivo",
  buttons: "Botones",
  delay: "Esperar",
  askInput: "Preguntar",
  condition: "Condición",
  action: "Acción",
  scheduleBooking: "Agendar cita",
  end: "Fin",
};

/** Devuelve un mensaje de error si el nodo está mal configurado, o null si está OK.
 *  Lo usa el builder para mostrar el badge rojo sobre nodos rotos. */
export function validarNodo(tipo: NodeTipo, data: Record<string, unknown>): string | null {
  switch (tipo) {
    case "trigger": {
      const t = (data.triggerType as string) ?? "first_message";
      if (t === "keyword") {
        const kws = (data.keywords as string[]) ?? [];
        if (kws.filter((k) => k?.trim()).length === 0) return "Sin palabras clave";
      }
      return null;
    }
    case "sendMessage": {
      const mediaKind = data.mediaKind as string | undefined;
      const mediaUrl = data.mediaUrl as string | undefined;
      const text = data.text as string | undefined;
      if (mediaKind && !mediaUrl?.trim()) return "Adjunto sin URL";
      if (!mediaKind && !text?.trim()) return "Mensaje vacío";
      return null;
    }
    case "sendImage":
      return (data.imageUrl as string)?.trim() ? null : "URL de imagen vacía";
    case "sendDocument":
      return (data.documentUrl as string)?.trim() ? null : "URL de archivo vacía";
    case "buttons": {
      if (!(data.text as string)?.trim()) return "Mensaje vacío";
      const botones = (data.buttons as Array<{ title: string }>) ?? [];
      return botones.filter((b) => b.title?.trim()).length === 0 ? "Agrega al menos un botón" : null;
    }
    case "delay": {
      const s = Number(data.seconds);
      return !s || s < 1 ? "Tiempo inválido" : null;
    }
    case "askInput": {
      if (!(data.question as string)?.trim()) return "Pregunta vacía";
      const saveAs = (data.saveAs as string) ?? "";
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(saveAs) ? null : "Variable inválida";
    }
    case "condition":
      return (data.variable as string)?.trim() ? null : "Variable vacía";
    case "action":
      return null;
    case "scheduleBooking": {
      if (!(data.titulo as string)?.trim()) return "Sin título";
      const dias = (data.dias as string[]) ?? [];
      if (dias.length === 0) return "Sin días disponibles";
      const ini = (data.horaInicio as string) ?? "";
      const fin = (data.horaFin as string) ?? "";
      if (!ini || !fin || ini >= fin) return "Horario inválido";
      return null;
    }
    case "end":
      return null;
    default:
      return null;
  }
}

export function defaultDataFor(tipo: NodeTipo): FlowNode["data"] {
  switch (tipo) {
    case "trigger":
      return { triggerType: "first_message" };
    case "sendMessage":
      return { text: "" };
    case "sendImage":
      return { imageUrl: "" };
    case "sendDocument":
      return { documentUrl: "" };
    case "buttons":
      return { text: "", buttons: [{ id: `b${rand4()}`, title: "" }, { id: `b${rand4()}`, title: "" }] };
    case "delay":
      return { seconds: 3 };
    case "askInput":
      return { question: "", saveAs: "", validation: "any" };
    case "condition":
      return { variable: "vars.", operator: "equals", value: "" };
    case "action":
      return { actionType: "handoff" };
    case "scheduleBooking":
      return { titulo: "Cita", duracionMinutos: 30, dias: ["LUN", "MAR", "MIE", "JUE", "VIE"], horaInicio: "09:00", horaFin: "18:00" };
    case "end":
      return {};
    default:
      return {};
  }
}

export const DIAS_SEMANA: { v: string; l: string }[] = [
  { v: "LUN", l: "L" }, { v: "MAR", l: "M" }, { v: "MIE", l: "X" }, { v: "JUE", l: "J" },
  { v: "VIE", l: "V" }, { v: "SAB", l: "S" }, { v: "DOM", l: "D" },
];

export function nodeId(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function rand4(): string {
  return Math.random().toString(36).slice(2, 6);
}
