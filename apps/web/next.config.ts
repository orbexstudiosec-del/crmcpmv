import type { NextConfig } from "next";

const apiInterna = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // El navegador siempre llama a /api en el mismo origen, así la misma imagen sirve para
  // cualquier dominio sin recompilar. En producción Caddy enruta /api al contenedor del API
  // antes de llegar aquí; este rewrite cubre el desarrollo local (web :3000 → API :4000).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInterna}/api/:path*` }];
  },
};

export default nextConfig;
