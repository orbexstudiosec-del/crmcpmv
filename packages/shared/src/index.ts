import { z } from 'zod';

// ─── Validadores reutilizados en API y Web ──────────────────────

export const rucSchema = z
  .string()
  .regex(/^\d{13}$/, 'El RUC debe tener 13 dígitos');

export const cedulaSchema = z
  .string()
  .regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos');

export const tipoIdentificacionSchema = z.enum([
  'RUC',
  'CEDULA',
  'PASAPORTE',
  'CONSUMIDOR_FINAL',
  'IDENTIFICACION_EXTERIOR',
]);

export const clienteInputSchema = z.object({
  tipoIdentificacion: tipoIdentificacionSchema,
  identificacion: z.string().min(3).max(20),
  razonSocial: z.string().min(1),
  nombreComercial: z.string().optional(),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
});
export type ClienteInput = z.infer<typeof clienteInputSchema>;

// ─── Auth ───────────────────────────────────────────────────────


export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const solicitarResetSchema = z.object({
  email: z.string().email(),
});
export type SolicitarResetInput = z.infer<typeof solicitarResetSchema>;

export const restablecerPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;

export const verificarEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerificarEmailInput = z.infer<typeof verificarEmailSchema>;

export const reenviarVerificacionSchema = z.object({
  email: z.string().email(),
});
export type ReenviarVerificacionInput = z.infer<typeof reenviarVerificacionSchema>;

/// Mensaje exacto que devuelve /auth/login cuando la cuenta existe y la contraseña es
/// correcta pero el correo no está verificado — el frontend lo compara para ofrecer
/// "reenviar verificación" en vez de solo mostrar el error.
export const MENSAJE_EMAIL_NO_VERIFICADO =
  'Tu correo aún no está verificado. Revisa tu bandeja de entrada o pide que te reenviemos el link.';

// ─── Equipo (roles, departamentos y sucursales) ───────────────────

/// Roles dentro de la empresa: OWNER y ADMIN administran todo; SUPERVISOR ve el trabajo del
/// equipo; AGENTE atiende conversaciones y oportunidades; GERENCIA es de solo lectura.
export const rolSchema = z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENTE', 'RIESGOS', 'GERENCIA']);
export type RolMiembro = z.infer<typeof rolSchema>;

export const departamentoInputSchema = z.object({
  nombre: z.string().min(1).max(80),
});
export type DepartamentoInput = z.infer<typeof departamentoInputSchema>;

/// Sucursal = ubicación física (ej. "Agencia Norte"). Independiente del departamento
/// (área funcional): un miembro puede tener ambos a la vez.
export const sucursalInputSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  /// Ciudad que atiende la agencia: los prospectos de esa ciudad se le envían a ella.
  ciudad: z.string().trim().max(80).nullish(),
});
export const actualizarSucursalSchema = sucursalInputSchema.partial();
export type ActualizarSucursalInput = z.infer<typeof actualizarSucursalSchema>;
export type SucursalInput = z.infer<typeof sucursalInputSchema>;

export const miembroInputSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: rolSchema.default('AGENTE'),
  departamentoId: z.string().optional(),
  sucursalId: z.string().optional(),
});
export type MiembroInput = z.infer<typeof miembroInputSchema>;

export const actualizarMiembroSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email().optional(),
  rol: rolSchema.optional(),
  departamentoId: z.string().nullable().optional(),
  sucursalId: z.string().nullable().optional(),
});
export type ActualizarMiembroInput = z.infer<typeof actualizarMiembroSchema>;

// ─── CRM: Leads, Oportunidades, Actividades ──────────────────────

export const leadEstadoSchema = z.enum(['NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO', 'CONVERTIDO']);
export type LeadEstado = z.infer<typeof leadEstadoSchema>;

export const leadInputSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  empresa: z.string().optional(),
  fuente: z.string().optional(), // ej. "Activación BTL — Feria X", "Formulario web"
  notas: z.string().optional(),
  ciudad: z.string().trim().max(80).optional(),
  /// Agencia elegida a mano. Si no se manda, se asigna sola según la ciudad.
  sucursalId: z.string().nullish(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const actualizarLeadSchema = leadInputSchema.partial().extend({
  estado: leadEstadoSchema.optional(),
});
export type ActualizarLeadInput = z.infer<typeof actualizarLeadSchema>;

// El embudo es 100% configurable por workspace (ver Organization.pipelineEtapas), así que acá
// solo se valida la forma. La pertenencia real al workspace se valida en el servicio
// (ver apps/api/src/common/etapa-pipeline.ts, usado por PipelineService y MensajesService).
export const etapaPipelineSchema = z.string().min(1).max(40);
export type EtapaPipeline = z.infer<typeof etapaPipelineSchema>;

/// Datos opcionales al convertir un lead en oportunidad (el título por defecto usa el nombre del lead).
export const convertirLeadSchema = z.object({
  titulo: z.string().optional(),
  monto: z.number().nonnegative().optional(),
  probabilidad: z.number().int().min(0).max(100).optional(),
  cierreEstimado: z.string().optional(),
});
export type ConvertirLeadInput = z.infer<typeof convertirLeadSchema>;

// ─── CRM: Formularios de leads (constructor de formularios) ─────────

export const tipoCampoFormularioSchema = z.enum(['TEXTO_CORTO', 'TEXTO_LARGO', 'TELEFONO', 'EMAIL', 'OPCION_UNICA', 'OPCION_MULTIPLE']);
export type TipoCampoFormulario = z.infer<typeof tipoCampoFormularioSchema>;

export const campoLeadFijoSchema = z.enum(['EMAIL', 'EMPRESA', 'NOTAS', 'CIUDAD']);
export type CampoLeadFijo = z.infer<typeof campoLeadFijoSchema>;

export const formularioLeadCampoInputSchema = z
  .object({
    tipo: tipoCampoFormularioSchema,
    etiqueta: z.string().min(1).max(120),
    obligatorio: z.boolean().default(false),
    opciones: z.array(z.string().min(1)).max(20).optional(),
    mapeaA: campoLeadFijoSchema.nullish(), // el frontend manda `null` explícito para "sin mapear", no solo undefined
  })
  .refine((v) => !['OPCION_UNICA', 'OPCION_MULTIPLE'].includes(v.tipo) || (v.opciones?.length ?? 0) >= 2, {
    message: 'Las preguntas de opción necesitan al menos 2 opciones',
    path: ['opciones'],
  });
export type FormularioLeadCampoInput = z.infer<typeof formularioLeadCampoInputSchema>;

export const formularioLeadInputSchema = z.object({
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(500).optional(),
  mensajeExito: z.string().max(300).optional(),
  activo: z.boolean().optional(),
  campos: z.array(formularioLeadCampoInputSchema).max(20).default([]),
});
export type FormularioLeadInput = z.infer<typeof formularioLeadInputSchema>;

/// Envío público de un formulario — la validación de que las respuestas cumplan lo que pide
/// CADA formulario (obligatorios, valores dentro de `opciones`) se hace en el service, porque
/// depende de qué formulario es. Acá solo se valida la forma base del payload.
export const formularioLeadEnvioSchema = z.object({
  nombre: z.string().min(1).max(120),
  telefono: z.string().min(6).max(20),
  // Topes de tamaño: es un endpoint público y sin ellos cualquiera podía guardar megas de texto
  // por envío en la base (el límite del cuerpo JSON del API es de 20 MB).
  respuestas: z
    .record(z.string().max(64), z.union([z.string().max(2000), z.array(z.string().max(200)).max(20)]))
    .refine((r) => Object.keys(r).length <= 40, 'Demasiadas respuestas')
    .optional(),
  // Honeypot anti-bot: campo real que un humano nunca llena (queda oculto en el formulario).
  // Sin límite de longitud a propósito — si viniera con .max(0), un bot que SÍ lo llena haría
  // que Zod rechace el request entero en vez de dejarlo pasar para responder éxito falso.
  _hp: z.string().optional(),
});
export type FormularioLeadEnvioInput = z.infer<typeof formularioLeadEnvioSchema>;

export const oportunidadInputSchema = z.object({
  titulo: z.string().min(1),
  clienteId: z.string().optional(),
  leadId: z.string().optional(),
  monto: z.number().nonnegative().default(0),
  probabilidad: z.number().int().min(0).max(100).default(0),
  cierreEstimado: z.string().optional(), // ISO date
});
export type OportunidadInput = z.infer<typeof oportunidadInputSchema>;

export const actualizarOportunidadSchema = z.object({
  titulo: z.string().min(1).optional(),
  etapa: etapaPipelineSchema.optional(),
  monto: z.number().nonnegative().optional(),
  probabilidad: z.number().int().min(0).max(100).optional(),
  cierreEstimado: z.string().nullable().optional(),
});
export type ActualizarOportunidadInput = z.infer<typeof actualizarOportunidadSchema>;

export const tipoActividadSchema = z.enum(['LLAMADA', 'EMAIL', 'REUNION', 'TAREA', 'NOTA', 'VISITA']);
export type TipoActividad = z.infer<typeof tipoActividadSchema>;

export const actividadInputSchema = z.object({
  tipo: tipoActividadSchema,
  asunto: z.string().min(1),
  detalle: z.string().optional(),
  inicio: z.string().optional(), // ISO date
  vencimiento: z.string().optional(), // ISO date
  clienteId: z.string().optional(),
  oportunidadId: z.string().optional(),
  leadId: z.string().optional(),
  conversacionId: z.string().optional(),
});
export type ActividadInput = z.infer<typeof actividadInputSchema>;

export const actualizarActividadSchema = actividadInputSchema.partial().extend({
  completada: z.boolean().optional(),
});
export type ActualizarActividadInput = z.infer<typeof actualizarActividadSchema>;

// ─── Configuración del workspace (Organization) ──────────────────

export const estadoConversacionSchema = z.enum(['ABIERTA', 'PENDIENTE', 'RESUELTA']);
export type EstadoConversacion = z.infer<typeof estadoConversacionSchema>;

export const etiquetaEstadoConversacionSchema = z.object({
  label: z.string().min(1).max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type EtiquetaEstadoConversacion = z.infer<typeof etiquetaEstadoConversacionSchema>;

export const etiquetasConversacionSchema = z.object({
  ABIERTA: etiquetaEstadoConversacionSchema.optional(),
  PENDIENTE: etiquetaEstadoConversacionSchema.optional(),
  RESUELTA: etiquetaEstadoConversacionSchema.optional(),
});
export type EtiquetasConversacion = z.infer<typeof etiquetasConversacionSchema>;

/// Todo el embudo de Oportunidades es configurable por workspace: cualquier etapa (incluidas
/// las que antes eran fijas, Ganada/Perdida) se puede renombrar, recolorear, reordenar o
/// eliminar. `tipo` reemplaza la comparación literal contra "GANADA"/"PERDIDA" para que el
/// cálculo de tasa de cierre siga funcionando aunque esas etapas cambien de nombre o de id.
export const tipoEtapaPipelineSchema = z.enum(['ABIERTA', 'GANADA', 'PERDIDA']);
export type TipoEtapaPipeline = z.infer<typeof tipoEtapaPipelineSchema>;

export const etapaPipelineDefSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  descripcion: z.string().max(140).optional(),
  tipo: tipoEtapaPipelineSchema,
});
export type EtapaPipelineDef = z.infer<typeof etapaPipelineDefSchema>;

export const organizacionUpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  etiquetasConversacion: etiquetasConversacionSchema.optional(),
  pipelineEtapas: z.array(etapaPipelineDefSchema).min(1).max(50).optional(),
  umbralLoteRiesgo: z.number().int().min(1).max(100).optional(),
});
export type OrganizacionUpdateInput = z.infer<typeof organizacionUpdateSchema>;

// ─── Campañas de marketing ─────────────────────────────────────────

export const canalCampanaSchema = z.enum(['EMAIL', 'SMS', 'WHATSAPP']);
export type CanalCampana = z.infer<typeof canalCampanaSchema>;

export const estadoCampanaSchema = z.enum(['BORRADOR', 'PROGRAMADA', 'ENVIANDO', 'ENVIADA']);
export type EstadoCampana = z.infer<typeof estadoCampanaSchema>;

export const publicoCampanaSchema = z.enum(['CLIENTES', 'LEADS', 'LEADS_FORMULARIO']);
export type PublicoCampana = z.infer<typeof publicoCampanaSchema>;

/// Canal de envío de las campañas de WhatsApp: solo la API oficial de Meta (el QR no está
/// autorizado para uso institucional).
export const canalWhatsappCampanaSchema = z.enum(['WHATSAPP_API']);
export type CanalWhatsappCampana = z.infer<typeof canalWhatsappCampanaSchema>;

export const campanaInputSchema = z
  .object({
    nombre: z.string().min(1),
    canal: canalCampanaSchema.default('EMAIL'),
    programadaPara: z.string().optional(), // ISO date
    mensaje: z.string().min(1).optional(), // descripción interna; WhatsApp envía la plantilla de Meta
    publico: publicoCampanaSchema.optional(), // requerido para WHATSAPP
    formularioLeadId: z.string().optional(), // requerido si publico = LEADS_FORMULARIO
    canalWhatsapp: canalWhatsappCampanaSchema.optional(),
    plantillaMeta: z.string().min(1).optional(), // requerido para WHATSAPP — nombre exacto aprobado en Meta
    plantillaMetaIdioma: z.string().min(1).optional(),
  })
  .refine((v) => v.canal !== 'WHATSAPP' || !!v.publico, {
    message: 'Las campañas de WhatsApp necesitan un público',
    path: ['publico'],
  })
  .refine((v) => v.canal !== 'WHATSAPP' || !!v.plantillaMeta, {
    message: 'Las campañas de WhatsApp necesitan el nombre de la plantilla aprobada en Meta',
    path: ['plantillaMeta'],
  })
  .refine((v) => v.publico !== 'LEADS_FORMULARIO' || !!v.formularioLeadId, {
    message: 'Elige de qué formulario vienen los leads',
    path: ['formularioLeadId'],
  });
export type CampanaInput = z.infer<typeof campanaInputSchema>;

// ─── Integraciones de mensajería (WhatsApp, Messenger, Instagram, TikTok) ──

/// WhatsApp solo por la API oficial de Meta (WhatsApp Business Platform): la conexión por
/// código QR no está autorizada para uso institucional y se retiró.
export const canalMensajeriaSchema = z.enum(['WHATSAPP_API', 'MESSENGER', 'INSTAGRAM', 'TIKTOK']);
export type CanalMensajeria = z.infer<typeof canalMensajeriaSchema>;

export const estadoIntegracionSchema = z.enum(['DESCONECTADO', 'PENDIENTE', 'CONECTADO', 'ERROR']);
export type EstadoIntegracion = z.infer<typeof estadoIntegracionSchema>;

/// WhatsApp Business Platform — API oficial de Meta (Cloud API).
export const credencialesWhatsappApiSchema = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  verifyToken: z.string().min(1),
  /// App Secret de la app de Meta. Con él se valida la firma de cada evento entrante; sin él
  /// el webhook solo queda protegido por el secreto de su URL.
  appSecret: z.string().min(1).optional(),
});
export type CredencialesWhatsappApi = z.infer<typeof credencialesWhatsappApiSchema>;

export const credencialesMessengerSchema = z.object({
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(1),
});
export type CredencialesMessenger = z.infer<typeof credencialesMessengerSchema>;

export const credencialesInstagramSchema = z.object({
  igBusinessId: z.string().min(1),
  accessToken: z.string().min(1),
});
export type CredencialesInstagram = z.infer<typeof credencialesInstagramSchema>;

export const credencialesTiktokSchema = z.object({
  clientKey: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().optional(),
});
export type CredencialesTiktok = z.infer<typeof credencialesTiktokSchema>;

export const conectarIntegracionSchema = z.discriminatedUnion('canal', [
  z.object({ canal: z.literal('WHATSAPP_API'), credenciales: credencialesWhatsappApiSchema }),
  z.object({ canal: z.literal('MESSENGER'), credenciales: credencialesMessengerSchema }),
  z.object({ canal: z.literal('INSTAGRAM'), credenciales: credencialesInstagramSchema }),
  z.object({ canal: z.literal('TIKTOK'), credenciales: credencialesTiktokSchema }),
]);
export type ConectarIntegracionInput = z.infer<typeof conectarIntegracionSchema>;

// ─── Mensajes (inbox unificado) ────────────────────────────────────

export const direccionMensajeSchema = z.enum(['ENTRANTE', 'SALIENTE']);
export type DireccionMensaje = z.infer<typeof direccionMensajeSchema>;

export const enviarMensajeSchema = z.object({
  contenido: z.string().min(1).max(4096),
});
export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;

export const iniciarConversacionSchema = z.object({
  numero: z.string().min(5).max(20),
});
export type IniciarConversacionInput = z.infer<typeof iniciarConversacionSchema>;

export const vincularClienteConversacionSchema = z.object({
  clienteId: z.string().nullable(),
});
export type VincularClienteConversacionInput = z.infer<typeof vincularClienteConversacionSchema>;

export const actualizarEtapaConversacionSchema = z.object({
  etapa: etapaPipelineSchema,
});
export type ActualizarEtapaConversacionInput = z.infer<typeof actualizarEtapaConversacionSchema>;

export const vincularLeadConversacionSchema = z.object({
  leadId: z.string().nullable(),
});
export type VincularLeadConversacionInput = z.infer<typeof vincularLeadConversacionSchema>;

export const crearLeadConversacionSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
});
export type CrearLeadConversacionInput = z.infer<typeof crearLeadConversacionSchema>;

export const pausarBotConversacionSchema = z.object({
  pausado: z.boolean(),
});
export type PausarBotConversacionInput = z.infer<typeof pausarBotConversacionSchema>;

export const conversacionEstadoSchema = z.enum(['ABIERTA', 'PENDIENTE', 'RESUELTA']);
export type ConversacionEstado = z.infer<typeof conversacionEstadoSchema>;

export const actualizarEstadoConversacionSchema = z.object({
  estado: conversacionEstadoSchema,
});
export type ActualizarEstadoConversacionInput = z.infer<typeof actualizarEstadoConversacionSchema>;

export const asignarConversacionSchema = z.object({
  membershipId: z.string().nullable(),
});
export type AsignarConversacionInput = z.infer<typeof asignarConversacionSchema>;

export const notaConversacionSchema = z.object({
  contenido: z.string().min(1).max(2000),
});
export type NotaConversacionInput = z.infer<typeof notaConversacionSchema>;

export const tipoMensajeSchema = z.enum(['TEXTO', 'IMAGEN', 'VIDEO', 'AUDIO', 'STICKER', 'DOCUMENTO']);
export type TipoMensaje = z.infer<typeof tipoMensajeSchema>;

export const actualizarCampanaSchema = z.object({
  nombre: z.string().min(1).optional(),
  canal: canalCampanaSchema.optional(),
  estado: estadoCampanaSchema.optional(),
  programadaPara: z.string().nullable().optional(),
  enviados: z.number().int().nonnegative().optional(),
  aperturas: z.number().int().nonnegative().optional(),
  respuestas: z.number().int().nonnegative().optional(),
  mensaje: z.string().min(1).optional(),
  publico: publicoCampanaSchema.optional(),
  formularioLeadId: z.string().optional(),
  canalWhatsapp: canalWhatsappCampanaSchema.optional(),
  plantillaMeta: z.string().min(1).optional(),
  plantillaMetaIdioma: z.string().min(1).optional(),
});
export type ActualizarCampanaInput = z.infer<typeof actualizarCampanaSchema>;

// ─── Bots: flujos conversacionales (editor visual de nodos) ──────
// v1: solo el editor + CRUD + activar/desactivar. Sin motor de ejecución
// todavía (eso necesitaría un modelo de estado de ejecución por conversación
// aparte). El nodo `action` por ahora solo soporta "handoff" — no hay tags
// ni un módulo de reuniones en el CRM para las otras variantes de orbexweb.
// El nodo `scheduleBooking` guarda su propia configuración de horario (días,
// franja, duración) directamente en el nodo — es diseño/configuración por
// ahora, igual que el resto de los nodos: todavía no hay motor que lo ejecute
// contra una conversación real ni que cree la cita en el calendario.

const posicionNodoSchema = z.object({ x: z.number(), y: z.number() }).optional();

export const flowNodeSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('trigger'),
    position: posicionNodoSchema,
    data: z.object({
      triggerType: z.enum(['first_message', 'keyword']).default('first_message'),
      keywords: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('sendMessage'),
    position: posicionNodoSchema,
    data: z.object({
      text: z.string().default(''),
      mediaUrl: z.string().optional(),
      mediaKind: z.enum(['image', 'document']).optional(),
      filename: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('sendImage'),
    position: posicionNodoSchema,
    data: z.object({ imageUrl: z.string().default(''), caption: z.string().optional() }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('sendDocument'),
    position: posicionNodoSchema,
    data: z.object({
      documentUrl: z.string().default(''),
      filename: z.string().optional(),
      caption: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('buttons'),
    position: posicionNodoSchema,
    data: z.object({
      text: z.string().default(''),
      buttons: z.array(z.object({
        id: z.string(),
        title: z.string(),
        isBack: z.boolean().optional(),
      })).default([]),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('delay'),
    position: posicionNodoSchema,
    data: z.object({ seconds: z.number().int().min(1).max(60).default(3) }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('askInput'),
    position: posicionNodoSchema,
    data: z.object({
      question: z.string().default(''),
      saveAs: z.string().default(''),
      validation: z.enum(['any', 'email', 'phone', 'number']).default('any'),
      retryMessage: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('condition'),
    position: posicionNodoSchema,
    data: z.object({
      variable: z.string().default(''),
      operator: z.enum(['equals', 'contains', 'exists']).default('equals'),
      value: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('action'),
    position: posicionNodoSchema,
    data: z.object({
      actionType: z.literal('handoff').default('handoff'),
      departmentId: z.string().optional(),
      handoffMessage: z.string().optional(),
      notifyPhone: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('scheduleBooking'),
    position: posicionNodoSchema,
    data: z.object({
      titulo: z.string().default('Cita'),
      duracionMinutos: z.number().int().min(5).max(480).default(30),
      dias: z.array(z.enum(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'])).default(['LUN', 'MAR', 'MIE', 'JUE', 'VIE']),
      horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('09:00'),
      horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('18:00'),
      mensajeConfirmacion: z.string().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('end'),
    position: posicionNodoSchema,
    data: z.object({}).default({}),
  }),
]);
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type NodeTipo = FlowNode['type'];
export const NODE_TIPOS: NodeTipo[] = [
  'trigger', 'sendMessage', 'sendImage', 'sendDocument', 'buttons',
  'delay', 'askInput', 'condition', 'action', 'scheduleBooking', 'end',
];

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
});
export type FlowEdge = z.infer<typeof flowEdgeSchema>;

export const flowDefinitionSchema = z.object({
  nodes: z.array(flowNodeSchema).default([]),
  edges: z.array(flowEdgeSchema).default([]),
});
export type FlowDefinition = z.infer<typeof flowDefinitionSchema>;
export const FLOW_VACIO: FlowDefinition = { nodes: [], edges: [] };

export const botPlantillaSchema = z.enum(['bienvenida_handoff', 'faq_botones', 'calificacion_leads']);
export type BotPlantilla = z.infer<typeof botPlantillaSchema>;

export const botFlowInputSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  canal: canalMensajeriaSchema.optional(),
  plantilla: botPlantillaSchema.optional(),
});
export type BotFlowInput = z.infer<typeof botFlowInputSchema>;

export const actualizarBotFlowSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  canal: canalMensajeriaSchema.nullable().optional(),
  definicion: flowDefinitionSchema.optional(),
});
export type ActualizarBotFlowInput = z.infer<typeof actualizarBotFlowSchema>;

// ─── Marca blanca de la instalación ─────────────────────────────

/// El logo viaja como data URL: se guarda en la base y se sirve con la marca, sin depender de
/// almacenamiento de archivos. ~300 KB de imagen codificada es el tope.
const imagenMarcaSchema = z
  .string()
  .max(400_000, 'La imagen es demasiado pesada (máximo ~300 KB)')
  // SVG queda fuera a propósito: puede llevar <script> y se renderiza como favicon (XSS almacenado).
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'La imagen debe ser PNG, JPG o WebP')
  .nullable()
  .optional();

export const marcaUpdateSchema = z.object({
  nombre: z.string().trim().min(1).max(40).optional(),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (usa #RRGGBB)').nullable().optional(),
  colorSecundario: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (usa #RRGGBB)').nullable().optional(),
  logo: imagenMarcaSchema,
  icono: imagenMarcaSchema,
});
export type MarcaUpdateInput = z.infer<typeof marcaUpdateSchema>;

export interface Marca {
  nombre: string;
  colorPrimario: string | null;
  colorSecundario: string | null;
  logo: string | null;
  icono: string | null;
}

export const MARCA_NOMBRE_DEFAULT = 'CPMV CRM';

// ─── Riesgos: análisis y aprobación de prospectos ────────────────

export const estadoRiesgoSchema = z.enum(['PENDIENTE', 'EN_ANALISIS', 'APROBADO', 'RECHAZADO', 'OBSERVADO']);
export type EstadoRiesgo = z.infer<typeof estadoRiesgoSchema>;

export const nivelRiesgoSchema = z.enum(['BAJO', 'MEDIO', 'ALTO']);
export type NivelRiesgo = z.infer<typeof nivelRiesgoSchema>;

/// Guardar/actualizar el análisis de un prospecto. `estado` es la decisión; el resto es el
/// respaldo de esa decisión. montoAprobado solo tiene sentido si estado = APROBADO.
export const analisisRiesgoInputSchema = z.object({
  estado: estadoRiesgoSchema,
  nivel: nivelRiesgoSchema.nullish(),
  puntaje: z.number().int().min(0).max(100).nullish(),
  montoSolicitado: z.number().nonnegative().nullish(),
  montoAprobado: z.number().nonnegative().nullish(),
  ingresos: z.number().nonnegative().nullish(),
  egresos: z.number().nonnegative().nullish(),
  /// Checklist { [clave]: boolean } — las claves las define el front (CRITERIOS_RIESGO).
  criterios: z.record(z.string(), z.boolean()).nullish(),
  observaciones: z.string().max(2000).nullish(),
}).refine((v) => v.estado !== 'RECHAZADO' || (v.observaciones ?? '').trim().length > 0, {
  message: 'Para rechazar un prospecto hay que indicar el motivo en observaciones',
  path: ['observaciones'],
});
export type AnalisisRiesgoInput = z.infer<typeof analisisRiesgoInputSchema>;