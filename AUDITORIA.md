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

## Actualización 22/10/2026 — retiro de WhatsApp por código QR

Por indicación de Sistemas, la conexión por código QR (Evolution API) no está autorizada para
uso institucional y se retiró por completo: el servicio `evolution` y `redis`, su código, su
configuración y sus datos (migración `20261022000000_quitar_whatsapp_qr`). WhatsApp queda solo
por la API oficial de Meta.

Con eso dejan de aplicar las filas de SSRF, de la URL de Evolution y de la API key de
Evolution: el código afectado ya no existe. El servidor del CRM tampoco descarga archivos de
URLs de los bots: esas URLs las descarga Meta directamente.

## Actualización 22/10/2026 — acceso por correo institucional

- Los usuarios ya no reciben contraseña del administrador: activan su cuenta con un enlace
  enviado a su correo institucional (72 h) y definen ahí su contraseña.
- Doble factor: en cada inicio de sesión se envía un código de 6 dígitos al correo (10 min,
  5 intentos, guardado como HMAC con `AUTH_SECRET`, un solo código vigente por persona).
- Solo se aceptan correos del dominio institucional (`CORREO_DOMINIOS_PERMITIDOS`).
- Se eliminó la "verificación manual" de Equipo y el enlace de verificación que abría sesión
  sin contraseña (migración `20261022100000_acceso_por_correo_institucional`).
- Cambiar el correo de un usuario obliga a reactivar la cuenta desde el nuevo buzón (cierra
  sesiones y anula la contraseña). Resuelve el pendiente de que un ADMIN pudiera quedarse con
  una cuenta ajena cambiando su correo.
- En producción, sin SMTP los enlaces y códigos ya no se imprimen en el log.

## Pendiente (decisión de producto o arquitectura)

- El token de sesión vive en `localStorage`; ante un XSS se podría robar. Pasarlo a cookie
  `httpOnly` implica cambiar la autenticación de la web.
- El doble factor depende del buzón institucional: su seguridad (contraseña y MFA del correo)
  la administra Sistemas.
- Si el API no arranca durante la instalación, `install.sh` deja `ADMIN_PASSWORD` en el `.env`.
