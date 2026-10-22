#!/usr/bin/env bash
# Instalador del CRM en un servidor Linux con Docker.
#
#   ./install.sh
#
# Pregunta el nombre del CRM, la empresa, el dominio y el administrador; genera las claves,
# escribe el .env y levanta todo (web, API, base de datos y HTTPS).
# Volver a ejecutarlo sobre una instalación existente la ACTUALIZA sin tocar datos ni claves.
#
# Para automatizar, cualquier respuesta se puede pasar como variable de entorno:
#   APP_NAME="Ventas Pro" COMPANY_NAME="Acme" DOMAIN="crm.acme.com" \
#   ADMIN_NAME="Ana" ADMIN_EMAIL="ana@acme.com" ADMIN_PASSWORD="..." ./install.sh

set -euo pipefail
cd "$(dirname "$0")"

ROJO=$'\033[31m'; VERDE=$'\033[32m'; NEGRITA=$'\033[1m'; FIN=$'\033[0m'
info()  { printf '%s\n' "${NEGRITA}==>${FIN} $*"; }
error() { printf '%s\n' "${ROJO}Error:${FIN} $*" >&2; }
fatal() { error "$*"; exit 1; }

# ── Requisitos ──────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  error "Docker no está instalado."
  read -r -p "¿Instalarlo ahora con el script oficial (get.docker.com)? [s/N] " r
  [[ "$r" =~ ^[sS]$ ]] || fatal "Instala Docker y vuelve a ejecutar ./install.sh"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || fatal "Falta el plugin 'docker compose' (Docker Compose v2)."
docker info >/dev/null 2>&1 || fatal "No se puede hablar con Docker. Ejecuta el instalador con sudo o agrega tu usuario al grupo docker."

esperar_api() {
  info "Esperando a que el sistema arranque (la primera vez tarda unos minutos)…"
  for _ in $(seq 1 90); do
    if docker compose exec -T api wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# ── Actualización de una instalación existente ──────────────────
if [[ -f .env ]]; then
  info "Ya existe una instalación en esta carpeta (.env). Se actualizará conservando datos y claves."
  # --remove-orphans: retira contenedores de servicios que ya no existen (ej. evolution y redis
  # de WhatsApp QR, que se quitó).
  docker compose up -d --build --remove-orphans
  esperar_api || fatal "El API no respondió. Revisa: docker compose logs api"
  printf '%s\n' "${VERDE}Actualización completada.${FIN}"
  exit 0
fi

# ── Preguntas ───────────────────────────────────────────────────
# El .env guarda cada valor entre comillas simples (literal, sin interpolación de Compose),
# así que lo único que no puede contener una respuesta es una comilla simple o un salto de línea.
validar() { [[ "$1" != *"'"* && "$1" != *$'\n'* ]]; }

preguntar() { # preguntar VARIABLE "Texto" "valor por defecto"
  local var="$1" texto="$2" defecto="${3:-}" valor="${!1:-}"
  while [[ -z "$valor" ]]; do
    if [[ -n "$defecto" ]]; then read -r -p "$texto [$defecto]: " valor; valor="${valor:-$defecto}"
    else read -r -p "$texto: " valor; fi
    validar "$valor" || { error "No uses comillas simples."; valor=""; }
  done
  validar "$valor" || fatal "$var no puede contener comillas simples."
  printf -v "$var" '%s' "$valor"
}

printf '\n%s\n\n' "${NEGRITA}Instalación del CRM${FIN}"

preguntar APP_NAME     "Nombre del CRM (el que verán los usuarios)" "CPMV CRM"
preguntar COMPANY_NAME "Nombre de la empresa" "Cooperativa Pablo Muñoz Vega"

if [[ -z "${DOMAIN+x}" ]]; then
  echo
  echo "Dominio del CRM, ya apuntando a la IP de este servidor (ej. crm.miempresa.com)."
  echo "Con dominio se activa HTTPS automático, necesario para WhatsApp API oficial, Instagram y Messenger."
  read -r -p "Dominio (déjalo vacío para usar la IP sin HTTPS): " DOMAIN
fi
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
if [[ -n "$DOMAIN" ]]; then
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || fatal "Dominio inválido: $DOMAIN"
  SITE_ADDRESS="$DOMAIN"
  WEB_URL="https://$DOMAIN"
else
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  SITE_ADDRESS=":80"
  WEB_URL="http://${IP:-localhost}"
fi

echo
preguntar ADMIN_NAME  "Nombre del administrador" "Administrador"
preguntar ADMIN_EMAIL "Correo del administrador"
[[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || fatal "Correo inválido: $ADMIN_EMAIL"

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  while true; do
    read -r -s -p "Contraseña del administrador (mínimo 8 caracteres): " ADMIN_PASSWORD; echo
    read -r -s -p "Repite la contraseña: " repetida; echo
    if [[ "$ADMIN_PASSWORD" != "$repetida" ]]; then error "No coinciden."
    elif (( ${#ADMIN_PASSWORD} < 8 )); then error "Debe tener al menos 8 caracteres."
    elif ! validar "$ADMIN_PASSWORD"; then error "No uses comillas simples."
    else break; fi
  done
fi
(( ${#ADMIN_PASSWORD} >= 8 )) || fatal "ADMIN_PASSWORD debe tener al menos 8 caracteres."
validar "$ADMIN_PASSWORD" || fatal "ADMIN_PASSWORD no puede contener comillas simples."

# ── Claves ──────────────────────────────────────────────────────
secreto() { # 64 caracteres hex (32 bytes)
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

umask 077
cat > .env <<EOF
# Generado por install.sh el $(date '+%Y-%m-%d %H:%M'). Guarda una copia segura de este archivo:
# sin ENCRYPTION_KEY no se pueden descifrar las integraciones ya conectadas.
APP_NAME='$APP_NAME'
COMPANY_NAME='$COMPANY_NAME'
ADMIN_NAME='$ADMIN_NAME'
ADMIN_EMAIL='$ADMIN_EMAIL'
ADMIN_PASSWORD='$ADMIN_PASSWORD'

SITE_ADDRESS='$SITE_ADDRESS'
WEB_URL='$WEB_URL'
TZ='${TZ:-America/Guayaquil}'

AUTH_SECRET='$(secreto)'
ENCRYPTION_KEY='$(secreto)'
POSTGRES_PASSWORD='$(secreto)'

# Correo saliente (opcional). Sin SMTP_HOST los enlaces de restablecer contraseña salen en
# el log del API: docker compose logs api
SMTP_HOST='${SMTP_HOST:-}'
SMTP_PORT='${SMTP_PORT:-587}'
SMTP_SECURE='${SMTP_SECURE:-false}'
SMTP_USER='${SMTP_USER:-}'
SMTP_PASS='${SMTP_PASS:-}'
SMTP_FROM='${SMTP_FROM:-}'
EOF

# ── Arranque ────────────────────────────────────────────────────
info "Construyendo e iniciando los servicios…"
docker compose up -d --build

if ! esperar_api; then
  fatal "El API no respondió a tiempo. El .env quedó escrito; revisa 'docker compose logs api' y vuelve a ejecutar ./install.sh"
fi

# El administrador ya existe en la base: su contraseña no tiene por qué seguir en el disco.
sed -i '/^ADMIN_PASSWORD=/d' .env

cat <<EOF

${VERDE}${NEGRITA}$APP_NAME quedó instalado.${FIN}

  Entra en:   $WEB_URL
  Usuario:    $ADMIN_EMAIL
  Contraseña: la que acabas de definir

Siguientes pasos dentro del sistema:
  - Configuración → Marca: logo y color.
  - Configuración → Integraciones: conecta WhatsApp Business (API oficial de Meta).
  - Equipo: crea los usuarios de la empresa.

Para actualizar más adelante: descarga la nueva versión en esta carpeta y ejecuta ./install.sh
Copia de seguridad de la base: docker compose exec -T postgres pg_dump -U crm crm > respaldo.sql
EOF
