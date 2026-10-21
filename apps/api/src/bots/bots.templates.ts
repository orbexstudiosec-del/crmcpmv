import type { BotPlantilla, FlowDefinition } from '@totalcrm/shared';

export interface PlantillaBot {
  id: BotPlantilla;
  nombre: string;
  descripcion: string;
  etiqueta: string;
  nombreSugerido: string;
  descripcionSugerida: string;
  definicion: FlowDefinition;
}

/** Plantilla mínima de arranque: saluda, pregunta el nombre y deriva a un humano. */
function bienvenidaHandoff(): FlowDefinition {
  return {
    nodes: [
      { id: 'n_trigger', type: 'trigger', position: { x: 60, y: 160 }, data: { triggerType: 'first_message' } },
      {
        id: 'n_hello',
        type: 'sendMessage',
        position: { x: 340, y: 160 },
        data: { text: '¡Hola! 👋 Soy el asistente virtual. Estoy aquí para ayudarte mientras un humano se conecta.' },
      },
      {
        id: 'n_ask_name',
        type: 'askInput',
        position: { x: 620, y: 160 },
        data: { question: '¿Cuál es tu nombre?', saveAs: 'nombre', validation: 'any' },
      },
      {
        id: 'n_ack',
        type: 'sendMessage',
        position: { x: 900, y: 160 },
        data: { text: 'Gracias {{vars.nombre}} 🙌. En un momento te atiende un asesor.' },
      },
      { id: 'n_handoff', type: 'action', position: { x: 1180, y: 160 }, data: { actionType: 'handoff' } },
    ],
    edges: [
      { id: 'e1', source: 'n_trigger', target: 'n_hello' },
      { id: 'e2', source: 'n_hello', target: 'n_ask_name' },
      { id: 'e3', source: 'n_ask_name', target: 'n_ack' },
      { id: 'e4', source: 'n_ack', target: 'n_handoff' },
    ],
  };
}

/** Menú de 3 botones (Precios/Horarios/Hablar con alguien) que responde automático o deriva. */
function faqBotones(): FlowDefinition {
  return {
    nodes: [
      { id: 'n_trigger', type: 'trigger', position: { x: 60, y: 160 }, data: { triggerType: 'first_message' } },
      {
        id: 'n_menu',
        type: 'buttons',
        position: { x: 340, y: 160 },
        data: {
          text: 'Hola 👋. ¿Sobre qué te gustaría saber?',
          buttons: [
            { id: 'b1', title: 'Precios' },
            { id: 'b2', title: 'Horarios' },
            { id: 'b3', title: 'Hablar con alguien' },
          ],
        },
      },
      {
        id: 'n_precios',
        type: 'sendMessage',
        position: { x: 620, y: -20 },
        data: { text: 'Nuestros planes empiezan desde $29/mes. Te paso a un asesor para detalles.' },
      },
      {
        id: 'n_horarios',
        type: 'sendMessage',
        position: { x: 620, y: 160 },
        data: { text: 'Atendemos de lunes a viernes, 9am a 6pm. Sábados 9am a 1pm.' },
      },
      { id: 'n_handoff', type: 'action', position: { x: 900, y: 340 }, data: { actionType: 'handoff' } },
      { id: 'n_end_horarios', type: 'end', position: { x: 900, y: 160 }, data: {} },
    ],
    edges: [
      { id: 'e1', source: 'n_trigger', target: 'n_menu' },
      { id: 'e2', source: 'n_menu', target: 'n_precios', sourceHandle: 'btn1' },
      { id: 'e3', source: 'n_menu', target: 'n_horarios', sourceHandle: 'btn2' },
      { id: 'e4', source: 'n_menu', target: 'n_handoff', sourceHandle: 'btn3' },
      { id: 'e5', source: 'n_menu', target: 'n_handoff', sourceHandle: 'fallback' },
      { id: 'e6', source: 'n_precios', target: 'n_handoff' },
      { id: 'e7', source: 'n_horarios', target: 'n_end_horarios' },
    ],
  };
}

/** Pregunta presupuesto, captura la respuesta y deriva a un asesor. */
function calificacionLeads(): FlowDefinition {
  return {
    nodes: [
      { id: 'n_trigger', type: 'trigger', position: { x: 60, y: 160 }, data: { triggerType: 'first_message' } },
      {
        id: 'n_intro',
        type: 'sendMessage',
        position: { x: 340, y: 160 },
        data: { text: '¡Hola! 👋 Para conectarte con la persona indicada, te hago una pregunta rápida.' },
      },
      {
        id: 'n_budget',
        type: 'buttons',
        position: { x: 620, y: 160 },
        data: {
          text: '¿Cuál es tu presupuesto aproximado?',
          buttons: [
            { id: 'b1', title: 'Menos de $500' },
            { id: 'b2', title: '$500 a $2000' },
            { id: 'b3', title: 'Más de $2000' },
          ],
        },
      },
      { id: 'n_thanks', type: 'sendMessage', position: { x: 900, y: 160 }, data: { text: 'Gracias 🙌. Te conecto con un asesor en un momento.' } },
      { id: 'n_handoff', type: 'action', position: { x: 1180, y: 160 }, data: { actionType: 'handoff' } },
    ],
    edges: [
      { id: 'e1', source: 'n_trigger', target: 'n_intro' },
      { id: 'e2', source: 'n_intro', target: 'n_budget' },
      { id: 'e3', source: 'n_budget', target: 'n_thanks', sourceHandle: 'btn1' },
      { id: 'e4', source: 'n_budget', target: 'n_thanks', sourceHandle: 'btn2' },
      { id: 'e5', source: 'n_budget', target: 'n_thanks', sourceHandle: 'btn3' },
      { id: 'e6', source: 'n_budget', target: 'n_thanks', sourceHandle: 'fallback' },
      { id: 'e7', source: 'n_thanks', target: 'n_handoff' },
    ],
  };
}

export const PLANTILLAS_BOT: PlantillaBot[] = [
  {
    id: 'bienvenida_handoff',
    nombre: 'Bienvenida + handoff',
    descripcion: 'Saluda al cliente, pregunta su nombre y pasa la conversación a un agente humano.',
    etiqueta: 'Recomendado',
    nombreSugerido: 'Bienvenida',
    descripcionSugerida: 'Recibe a clientes nuevos, captura el nombre y deriva a un humano.',
    definicion: bienvenidaHandoff(),
  },
  {
    id: 'faq_botones',
    nombre: 'FAQ con botones',
    descripcion: 'Menú con 3 botones (Precios, Horarios, Hablar con alguien). Responde la pregunta automática o pasa a humano.',
    etiqueta: 'Más usado',
    nombreSugerido: 'FAQ con botones',
    descripcionSugerida: 'Responde preguntas frecuentes con botones. Si el cliente quiere hablar con alguien, lo deriva.',
    definicion: faqBotones(),
  },
  {
    id: 'calificacion_leads',
    nombre: 'Calificación de leads',
    descripcion: 'Pregunta presupuesto al cliente y deriva a un asesor según la respuesta.',
    etiqueta: 'Pro',
    nombreSugerido: 'Calificación de leads',
    descripcionSugerida: 'Captura el presupuesto del lead antes del handoff, para que el asesor llegue con contexto.',
    definicion: calificacionLeads(),
  },
];

export function obtenerPlantilla(id: string): PlantillaBot | null {
  return PLANTILLAS_BOT.find((p) => p.id === id) ?? null;
}
