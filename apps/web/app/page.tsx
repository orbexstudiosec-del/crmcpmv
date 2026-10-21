import { redirect } from "next/navigation";

// Instalación privada de una empresa: no hay sitio público, la raíz lleva al acceso.
export default function Inicio() {
  redirect("/login");
}
