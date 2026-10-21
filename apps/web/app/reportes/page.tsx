"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { UserPlus, Workflow, HandCoins, TrendingUp, Download, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Kpi, DonutCard, FunnelChart, BarChart, EmptyState } from "@/components/crm-widgets";
import { api } from "@/lib/api";
import {
  type Lead, type Oportunidad, type EtapaPipelineDef,
  ACENTOS_KPI, money, idsGanada, pipelineEfectivo,
  tendenciaConteo, tendenciaMonto, tendenciaConversionPts,
  construirFunnel, pipelinePorEtapa, leadsPorFuente, oportunidadesPorSemana, type Tendencia,
} from "@/lib/crm";
import { exportarExcel, exportarPDF, type TablaExport } from "@/lib/exportar";

interface OrganizacionLite { pipelineEtapas: EtapaPipelineDef[] | null }

export default function ReportesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [pipelineEtapasOrg, setPipelineEtapasOrg] = useState<EtapaPipelineDef[] | null>(null);

  useEffect(() => {
    api<Lead[]>("/leads").then(setLeads).catch(() => {});
    api<Oportunidad[]>("/oportunidades").then(setOportunidades).catch(() => {});
    api<OrganizacionLite>("/organizacion").then((o) => setPipelineEtapasOrg(o.pipelineEtapas)).catch(() => {});
  }, []);

  const etapasPipeline = pipelineEfectivo(pipelineEtapasOrg);
  const ganadaIds = idsGanada(etapasPipeline);
  const ganadas = oportunidades.filter((o) => ganadaIds.has(o.etapa));
  const ventasGanadas = ganadas.reduce((s, o) => s + Number(o.monto), 0);
  const tasaConversion = oportunidades.length > 0 ? Math.round((ganadas.length / oportunidades.length) * 100) : 0;

  const funnelData = construirFunnel(oportunidades, etapasPipeline);
  const pipelineData = pipelinePorEtapa(oportunidades, etapasPipeline);
  const fuenteData = leadsPorFuente(leads);
  const serieSemanal = oportunidadesPorSemana(oportunidades, etapasPipeline, 8);

  const kpis: { icon: LucideIcon; titulo: string; valor: number | string; tendencia: Tendencia }[] = [
    { icon: UserPlus, titulo: "Leads", valor: leads.length, tendencia: tendenciaConteo(leads.map((l) => l.createdAt)) },
    { icon: Workflow, titulo: "Oportunidades", valor: oportunidades.length, tendencia: tendenciaConteo(oportunidades.map((o) => o.createdAt)) },
    { icon: HandCoins, titulo: "Ventas ganadas", valor: money(ventasGanadas), tendencia: tendenciaMonto(ganadas.map((o) => ({ createdAt: o.createdAt, monto: Number(o.monto) }))) },
    { icon: TrendingUp, titulo: "Tasa de conversión", valor: `${tasaConversion}%`, tendencia: tendenciaConversionPts(oportunidades, etapasPipeline) },
  ];

  const sinDatos = leads.length === 0 && oportunidades.length === 0;

  function tablasReportes(): TablaExport[] {
    return [
      { titulo: "KPIs", columnas: ["Métrica", "Valor"], filas: kpis.map((k) => [k.titulo, k.valor]) },
      { titulo: "Embudo de oportunidades", columnas: ["Etapa", "Cantidad"], filas: funnelData.map((f) => [f.l, f.count]) },
      { titulo: "Pipeline de ventas", columnas: ["Etapa", "Monto"], filas: pipelineData.map((d) => [d.label, d.value]) },
      { titulo: "Leads por fuente", columnas: ["Fuente", "Cantidad"], filas: fuenteData.map((d) => [d.label, d.value]) },
      { titulo: "Oportunidades por semana", columnas: ["Semana", "Creadas", "Ganadas"], filas: serieSemanal.map((s) => [s.etiqueta, s.creadas, s.ganadas]) },
    ];
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Reportes</h1>
          <p className="mt-1 text-sm text-muted">Métricas de tu embudo de ventas, calculadas en vivo desde tus datos.</p>
        </div>
        {!sinDatos && (
          <div className="flex gap-1.5">
            <button
              onClick={() => exportarExcel(tablasReportes(), "reportes-crm")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground"
            >
              <Download size={13} /> Excel
            </button>
            <button
              onClick={() => exportarPDF("Reportes", tablasReportes(), "reportes-crm")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground"
            >
              <FileText size={13} /> PDF
            </button>
          </div>
        )}
      </div>

      {sinDatos ? (
        <div className="mt-6"><EmptyState texto="Aún no hay datos de CRM para reportar. Crea leads y oportunidades para ver métricas aquí." /></div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpis.map((k, i) => (
              <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={k.tendencia} color={ACENTOS_KPI[i % ACENTOS_KPI.length]} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-display text-base font-bold text-foreground">Embudo de oportunidades</h2>
              {oportunidades.length === 0 ? (
                <EmptyState texto="Aún no tienes oportunidades." />
              ) : (
                <div className="mt-5"><FunnelChart data={funnelData} total={oportunidades.length} /></div>
              )}
            </div>

            {pipelineData.length > 0
              ? <DonutCard titulo="Pipeline de ventas" data={pipelineData} formato={money} />
              : <div className="card p-5"><h2 className="font-display text-base font-bold text-foreground">Pipeline de ventas</h2><EmptyState texto="Sin oportunidades con monto todavía." /></div>}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {fuenteData.length > 0 && (
              <DonutCard titulo="Leads por fuente" data={fuenteData} formato={(v) => `${v}`} />
            )}

            <div className="card p-5 lg:col-span-2">
              <h2 className="font-display text-base font-bold text-foreground">Oportunidades creadas por semana</h2>
              <p className="text-xs text-muted">Últimas 8 semanas</p>
              <div className="mt-5">
                <BarChart
                  data={serieSemanal.map((s) => ({ label: s.etiqueta, value: s.ganadas, valorFondo: s.creadas }))}
                  formato={(v) => `${v}`}
                  color="var(--color-primary)"
                  leyenda={{ value: "Ganadas", valorFondo: "Creadas" }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
