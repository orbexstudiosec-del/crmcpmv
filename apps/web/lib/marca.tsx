"use client";

import { createContext, useContext, useState } from "react";
import { MARCA_NOMBRE_DEFAULT, type Marca } from "@totalcrm/shared";
import { variablesColorMarca } from "./marca-color";

export const MARCA_DEFAULT: Marca = { nombre: MARCA_NOMBRE_DEFAULT, colorPrimario: null, colorSecundario: null, logo: null, icono: null };

const MarcaContext = createContext<{ marca: Marca; setMarca: (m: Marca) => void }>({
  marca: MARCA_DEFAULT,
  setMarca: () => {},
});

/** La marca llega resuelta desde el servidor (app/layout.tsx la pide al API en cada request),
 * así el nombre correcto ya viene en el primer HTML y no parpadea el nombre por defecto. */
export function MarcaProvider({ inicial, children }: { inicial: Marca; children: React.ReactNode }) {
  const [marca, setMarcaEstado] = useState(inicial);

  function setMarca(m: Marca) {
    setMarcaEstado(m);
    document.title = m.nombre;
    aplicarColorMarca(m.colorPrimario, m.colorSecundario);
  }

  return <MarcaContext.Provider value={{ marca, setMarca }}>{children}</MarcaContext.Provider>;
}

export function useMarca() {
  return useContext(MarcaContext);
}

const CLAVES_COLOR = Object.keys(variablesColorMarca("#000000", "#000000"));

function aplicarColorMarca(color: string | null, secundario: string | null) {
  const estilo = document.documentElement.style;
  CLAVES_COLOR.forEach((clave) => estilo.removeProperty(clave));
  Object.entries(variablesColorMarca(color, secundario)).forEach(([clave, valor]) => estilo.setProperty(clave, valor));
}

// Identidad de la Cooperativa Pablo Muñoz Vega, incluida en la aplicación (apps/web/public/marca).
// Lo que se suba en Configuración → Marca reemplaza al logo blanco y al ícono.
export const LOGO_BLANCO = "/marca/logo-blanco.png"; // letras blancas: para fondos oscuros
export const LOGO_COLOR = "/marca/logo-color.png"; // letras oscuras: para fondos claros
export const ICONO = "/marca/icono.png"; // solo el símbolo

/** Logo horizontal. `claro` = sobre fondo oscuro (logo de letras blancas). Sin `claro` va sobre
 * el fondo de la app: logo a color en tema claro y el de letras blancas en tema oscuro. */
export function MarcaLogo({ className = "", claro = false }: { className?: string; claro?: boolean }) {
  const { marca } = useMarca();
  const blanco = marca.logo ?? LOGO_BLANCO;
  /* eslint-disable @next/next/no-img-element -- imágenes de marca: estáticas o data URL de la base */
  if (claro) return <img src={blanco} alt={marca.nombre} className={`w-auto object-contain ${className}`} />;
  return (
    <>
      <img src={LOGO_COLOR} alt={marca.nombre} className={`w-auto object-contain dark:hidden ${className}`} />
      <img src={blanco} alt={marca.nombre} className={`hidden w-auto object-contain dark:block ${className}`} />
    </>
  );
  /* eslint-enable @next/next/no-img-element */
}