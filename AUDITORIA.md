# Auditoría de seguridad — 21/10/2026

Revisión del API (NestJS), la web (Next.js) y la infraestructura de despliegue. Todo lo de la
tabla quedó corregido y verificado con pruebas end-to-end contra el API real (22/22 OK) y
pruebas de SSRF contra direcciones internas.

## Corregido

| Gravedad | Problema | Corrección |
|---|---|---|
| Alta | Los permisos por rol solo se aplicaban en la interfaz: por API, un AGENTE podía gestionar bots y formularios, GERENCIA (solo lectura) podía modificar datos, y RIESGOS/GERENCIA leían todas las conversaciones. | Guards de rol en `bots`, `formularios-lead` y `mensajes`; GERENCIA queda en solo lectura en `TenancyGuard` (excepto marcar notificaciones). |
| Alta | SSRF: el motor de bots descargaba la URL de imagen/documento de un nodo sin validarla. | `descargarUrlExterna` (`common/ssrf.ts`): valida la IP resuelta, no sigue redirecciones, límite de tamaño y tiempo. |
| Alta | En Docker no se podía conectar WhatsApp QR: el filtro SSRF bloqueaba `http://evolution:8080` (IP privada). | La URL de Evolution del propio servidor no pasa por el filtro; las que escribe el usuario sí. |
| Alta | Con una URL de Evolution externa sin API key, se enviaba la API key global del servidor a ese tercero. | La key del servidor solo se usa con el Evolution del servidor. |
| Media | Las actividades aceptaban `leadId`, `clienteId`, `oportunidadId` o `conversacionId` de otra organización. | Validación de pertenencia en `PipelineService`. |
| Media | Un jefe de agencia podía abrir en Riesgos prospectos de otras agencias. | `cola` y `obtener` filtran por la agencia del miembro. |
| Media | Restablecer la contraseña no cerraba las sesiones abiertas (JWT válido 7 días). | Columna `User.sesionesValidasDesde` (migración `20261021000000_revocar_sesiones`), comprobada en `JwtAuthGuard`; el reset también invalida los demás links pendientes. |
| Media | Inyección de HTML en correos con datos del formulario público. | Escapado de valores en `MailService`. |
| Media | Campañas: doble envío con dos clics seguidos; quedaban trabadas en ENVIANDO si el API se reiniciaba. | Paso atómico a ENVIANDO; al arrancar se retoman los envíos interrumpidos; ENVIANDO no se puede poner a mano. |
| Baja | El formulario público aceptaba respuestas de varios MB. | Topes de tamaño en `formularioLeadEnvioSchema`. |
| Baja | `?limite=abc` en notificaciones devolvía 500. | Valor inválido usa el límite por defecto. |
| Baja | Sin límite de intentos en `reset-password` y `verify-email`. | Rate limit por IP. |
| Baja | El `hub.challenge` del webhook de Meta se devolvía como HTML (XSS reflejado). | Respuesta `text/plain`. |
| Baja | Un documento recibido por WhatsApp con mimetype HTML podía abrirse como página. | Descarga forzada como binario. |

## Pendiente (decisión de producto o arquitectura)

- El token de sesión vive en `localStorage`; ante un XSS se podría robar. Pasarlo a cookie
  `httpOnly` implica cambiar la autenticación de la web.
- Un ADMIN puede cambiar el correo de otro usuario sin reverificación y luego pedir un reset
  a ese correo.
- La imagen de Evolution API está en `:latest`; conviene fijar una versión antes de vender
  instalaciones.
- Si el API no arranca durante la instalación, `install.sh` deja `ADMIN_PASSWORD` en el `.env`.
