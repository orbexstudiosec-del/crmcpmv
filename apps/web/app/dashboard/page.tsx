"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Users, UserPlus, Workflow, HandCoins, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Kpi, DonutCard, FunnelChart, EmptyState } from "@/components/crm-widgets";
import { api, leerSesion, EVENTO_SESION, type Sesion } from "@/lib/api";
import {
  type Lead, type Oportunidad, type Actividad, type EtapaPipelineDef,
  ACENTOS_KPI, TIPO_ICONO, TIPO_ICONO_DEFAULT, money, tiempoRelativo,
  tendenciaConteo, tendenciaMonto, tendenciaConversionPts, idsGanada, pipelineEfectivo,
  construirFunnel, pipelinePorEtapa, leadsPorFuente, inicioSemana, type Tendencia,
} from "@/lib/crm";
// Cliente aún no expone su propio tipo compartido (vive en @/app/clientes/page); lo definimos local con lo que usamos.
interface Cliente { id: string; createdAt: string }
interface OrganizacionLite { pipelineEtapas: EtapaPipelineDef[] | null }

export default function DashboardPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [pipelineEtapasOrg, setPipelineEtapasOrg] = useState<EtapaPipelineDef[] | null>(null);

  useEffect(() => {
    setSesion(leerSesion());
    // El nombre de la empresa puede cambiar después de iniciar sesión (ver AppShell).
    const onSesionCambio = () => setSesion(leerSesion());
    window.addEventListener(EVENTO_SESION, onSesionCambio);
    api<Cliente[]>("/clientes").then(setClientes).catch(() => {});
    api<Lead[]>("/leads").then(setLeads).catch(() => {});
    api<Oportunidad[]>("/oportunidades").then(setOportunidades).catch(() => {});
    api<Actividad[]>("/actividades").then(setActividades).catch(() => {});
    api<OrganizacionLite>("/organizacion").then((o) => setPipelineEtapasOrg(o.pipelineEtapas)).catch(() => {});
    return () => window.removeEventListener(EVENTO_SESION, onSesionCambio);
  }, []);

  // ── Derivados del CRM (datos reales, sin inventar cifras) ──
  const etapasPipeline = pipelineEfectivo(pipelineEtapasOrg);
  const ganadaIds = idsGanada(etapasPipeline);
  const ganadas = oportunidades.filter((o) => ganadaIds.has(o.etapa));
  const ventasGanadas = ganadas.reduce((s, o) => s + Number(o.monto), 0);
  const tasaConversion = oportunidades.length > 0 ? Math.round((ganadas.length / oportunidades.length) * 100) : 0;

  const funnelData = construirFunnel(oportunidades, etapasPipeline);
  const pipelineData = pipelinePorEtapa(oportunidades, etapasPipeline);
  const fuenteData = leadsPorFuente(leads);

  const actividadesRecientes = [...actividades].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);
  const tareasPendientes = actividades.filter((a) => !a.completada).slice(0, 5);

  // KPIs con tendencia real (semana actual vs. anterior)
  const kpis: { icon: LucideIcon; titulo: string; valor: number | string; tendencia: Tendencia }[] = [
    { icon: Users, titulo: "Clientes", valor: clientes.length, tendencia: tendenciaConteo(clientes.map((c) => c.createdAt)) },
    { icon: UserPlus, titulo: "Leads", valor: leads.length, tendencia: tendenciaConteo(leads.map((l) => l.createdAt)) },
    { icon: Workflow, titulo: "Oportunidades", valor: oportunidades.length, tendencia: tendenciaConteo(oportunidades.map((o) => o.createdAt)) },
    { icon: HandCoins, titulo: "Ventas ganadas", valor: money(ventasGanadas), tendencia: tendenciaMonto(ganadas.map((o) => ({ createdAt: o.createdAt, monto: Number(o.monto) }))) },
    { icon: TrendingUp, titulo: "Tasa de conversión", valor: `${tasaConversion}%`, tendencia: tendenciaConversionPts(oportunidades, etapasPipeline) },
  ];

  const lunes = inicioSemana();
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const rangoSemana = `${lunes.toLocaleDateString("es-EC", { day: "numeric", month: "short" })} – ${domingo.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <AppShell>
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            ¡Bienvenido, {sesion?.nombre?.split(" ")[0] ?? ""}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            Aquí tienes el resumen de <span className="font-medium text-foreground">{sesion?.orgNombre ?? "tu negocio"}</span>.
          </p>
        </div>
        <span className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
          {rangoSemana}
        </span>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={k.tendencia} color={ACENTOS_KPI[i % ACENTOS_KPI.length]} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Embudo de oportunidades */}
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-display text-base font-bold text-foreground">Resumen de oportunidades</h2>
            {oportunidades.length === 0 ? (
              <EmptyState texto="Aún no tienes oportunidades. Se crean desde un lead o directamente en Oportunidades." />
            ) : (
              <div className="mt-5">
                <FunnelChart data={funnelData} total={oportunidades.length} />
              </div>
            )}
          </div>

          {/* Actividades recientes */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">Actividades recientes</h2>
              <Link href="/actividades" className="text-xs font-medium text-primary hover:underline">Ver todas</Link>
            </div>
            {actividadesRecientes.length === 0 ? (
              <EmptyState texto="Sin actividades todavía." />
            ) : (
              <ul className="mt-3 space-y-3">
                {actividadesRecientes.map((a) => {
                  const Icon = TIPO_ICONO[a.tipo] ?? TIPO_ICONO_DEFAULT;
                  return (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.asunto}</p>
                        <p className="text-xs text-muted">{tiempoRelativo(a.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
      </div>

      {(oportunidades.length > 0 || leads.length > 0 || tareasPendientes.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {pipelineData.length > 0 && (
            <DonutCard titulo="Pipeline de ventas" data={pipelineData} formato={money} />
          )}
          {fuenteData.length > 0 && (
            <DonutCard titulo="Leads por fuente" data={fuenteData} formato={(v) => `${v}`} />
          )}

          {/* Tareas pendientes */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">Tareas pendientes</h2>
              <Link href="/actividades" className="text-xs font-medium text-primary hover:underline">Ver todas</Link>
            </div>
            {tareasPendientes.length === 0 ? (
              <EmptyState texto="No tienes tareas pendientes." />
            ) : (
              <ul className="mt-3 space-y-2.5">
                {tareasPendientes.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <span className="h-3.5 w-3.5 shrink-0 rounded border border-border" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{t.asunto}</span>
                    <VencimientoTag iso={t.vencimiento} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function VencimientoTag({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const fecha = new Date(iso);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
  const dia = new Date(fecha); dia.setHours(0, 0, 0, 0);

  if (dia.getTime() === hoy.getTime()) {
    return <span className="shrink-0 text-xs font-semibold text-red-500">Hoy</span>;
  }
  if (dia.getTime() === manana.getTime()) {
    return <span className="shrink-0 text-xs font-semibold text-amber-500">Mañana</span>;
  }
  return <span className="shrink-0 text-xs text-muted">{fecha.toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>;
}
