# Instalación en el servidor de un cliente

Cada empresa tiene su propia instalación: su servidor, su base de datos, su nombre de CRM.

## Requisitos

- Servidor Linux (Ubuntu 22.04+ o Debian 12+) con 2 vCPU y 4 GB de RAM como mínimo. La
  primera instalación compila las imágenes en el propio servidor; con menos memoria el build
  de la web puede fallar.
- Puertos 80 y 443 abiertos.
- Un dominio o subdominio apuntando a la IP del servidor (registro A). WhatsApp se atiende
  solo por la API oficial de Meta, que entrega los mensajes entrantes a un webhook con HTTPS
  alcanzable desde internet (`/api/mensajes/webhook/meta/...`). Sin dominio el CRM funciona
  por IP, pero no recibe mensajes de WhatsApp.
- Salida a internet hacia `graph.facebook.com` para enviar mensajes.

## Instalar

```bash
# copiar la carpeta del proyecto al servidor, por ejemplo en /opt/crm
cd /opt/crm
chmod +x install.sh
./install.sh
```

El instalador pregunta:

| Dato | Para qué |
|---|---|
| Nombre del CRM | Marca blanca: pestaña del navegador, login, menú y correos |
| Nombre de la empresa | La organización dueña de la instalación |
| Dominio | HTTPS automático (Let's Encrypt). Vacío = por IP, sin HTTPS |
| Nombre, correo y contraseña del administrador | Primer usuario, con rol propietario |

Genera las claves (`AUTH_SECRET`, `ENCRYPTION_KEY` y contraseña de Postgres), escribe
`.env` y levanta los servicios. Al terminar borra `ADMIN_PASSWORD` del
`.env`.

**Guarda una copia del `.env` fuera del servidor.** Sin `ENCRYPTION_KEY` no se pueden
descifrar las credenciales de los canales ya conectados.

## Servicios

| Contenedor | Función |
|---|---|
| `caddy` | HTTPS y enrutado: `/api/*` al API, el resto a la web |
| `web` | Interfaz (Next.js) |
| `api` | Backend (NestJS). Aplica las migraciones al arrancar |
| `postgres` | Base de datos `crm` |

WhatsApp por código QR (Evolution API) no está autorizado para uso institucional y se retiró.
Al actualizar una instalación que lo tenía, `./install.sh` retira los contenedores `evolution`
y `redis`. La base `evolution` y los volúmenes `evolution_instances` y `redisdata` no se
tocan; se pueden borrar a mano cuando ya no se necesiten.

## Operación

```bash
./install.sh                     # actualizar tras copiar una versión nueva (conserva datos y claves)
docker compose ps                # estado
docker compose logs -f api       # logs del backend (aquí salen los enlaces de correo si no hay SMTP)
docker compose exec -T postgres pg_dump -U crm crm > respaldo.sql   # copia de seguridad
```

Cambiar el nombre, el logo o el color del CRM no requiere tocar el servidor: se hace en
**Configuración → Marca**.

## Correo saliente

Para que "olvidé mi contraseña" y la verificación de usuarios lleguen por correo, completa
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` en `.env` y ejecuta
`docker compose up -d api`. Sin SMTP el administrador puede verificar usuarios a mano desde
**Equipo**.
