import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { ConfirmDialogHost } from "@/components/confirm-dialog";
import { MarcaProvider } from "@/lib/marca";
import { variablesColorMarca } from "@/lib/marca-color";
import { obtenerMarca } from "@/lib/marca-servidor";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

// El nombre, el logo y el color son de cada instalación y se editan sin recompilar: la marca
// se resuelve en cada request, nunca en el build.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await obtenerMarca();
  return {
    title: marca.nombre,
    description: `${marca.nombre} — prospectos, socios y conversaciones de la Cooperativa Pablo Muñoz Vega.`,
    // Sin ícono propio se usa app/icon.png (el símbolo de la cooperativa).
    icons: marca.icono ? { icon: marca.icono } : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const marca = await obtenerMarca();
  return (
    <html
      lang="es"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
      style={variablesColorMarca(marca.colorPrimario, marca.colorSecundario) as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground">
        <MarcaProvider inicial={marca}>
          {children}
          <ConfirmDialogHost />
        </MarcaProvider>
      </body>
    </html>
  );
}
