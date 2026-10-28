"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChevronLeft, ChevronRight, X, CalendarDays, List, Download, Lightbulb, Eye, CheckCircle2, Send,
  Sparkles, Loader2, Trash2, Clock, Settings2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Kpi } from "@/components/crm-widgets";
import { confirmDialog } from "@/components/confirm-dialog";
import { api, leerSesion, EVENTO_SESION } from "@/lib/api";
import { exportarExcel } from "@/lib/exportar";
import { ConfiguracionIA } from "@/components/cronopost/configuracion-ia";
import { GenerarPlanModal } from "@/components/cronopost/generar-plan-modal";
import {
  REDES, TIPOS_PIEZA, ESTADOS, TONOS, redInfo, tipoInfo, estadoInfo, limiteCopy,
  type Publicacion, type RedSocial, type TipoPieza, type EstadoPublicacion, type TonoCopy, type CronopostConfig, type Categoria,
} from "@/lib/cronopost";

const SIN_CATEGORIA_COLOR = "#94a3b8";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ROLES_EDITORES = ["OWNER", "ADMIN", "SUPERVISOR"];

/** Rol de la sesión, leído del navegador sin pasar por un efecto (en el servidor no hay sesión). */
function useRolSesion(): string {
  return useSyncExternalStore(
    (avisar) => { window.addEventListener(EVENTO_SESION, avisar); return () => window.removeEventListener(EVENTO_SESION, avisar); },
    () => leerSesion()?.rol ?? "",
    () => "",
  );
}

interface MiembroLite { id: string; user: { nombre: string } }

function generarCalendario(cursor: Date): Date[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const offsetInicio = (primerDia.getDay() + 6) % 7; // lunes = 0
  const dias: Date[] = [];
  for (let i = offsetInicio; i > 0; i--) dias.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d));
  const offsetFin = (7 - (dias.length % 7)) % 7;
  for (let i = 1; i <= offsetFin; i++) dias.push(new Date(year, month + 1, i));
  return dias;
}

const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dosDigitos = (n: number) => String(n).padStart(2, "0");
const fechaInput = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const horaInput = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
function mayuscula(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lo que se edita en el modal: una publicación existente o una nueva con la fecha propuesta. */
type Edicion = { publicacion: Publicacion | null; fecha: Date };

export default function CronopostPage() {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [miembros, setMiembros] = useState<MiembroLite[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [vista, setVista] = useState<"calendario" | "lista" | "configuracion">("calendario");
  const [config, setConfig] = useState<CronopostConfig | null>(null);
  const [generarAbierto, setGenerarAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtroRed, setFiltroRed] = useState<RedSocial | "TODAS">("TODAS");
  const [filtroEstado, setFiltroEstado] = useState<EstadoPublicacion | "TODOS">("TODOS");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  /** "TODAS", "SIN" (sin categoría) o el id de una categoría. */
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  // GERENCIA ve el cronopost en solo lectura; el API también le bloquea cualquier cambio.
  const puedeEditar = ROLES_EDITORES.includes(useRolSesion());
  const hoy = new Date();

  const dias = useMemo(() => generarCalendario(cursor), [cursor]);
  const mesActual = cursor.getMonth();

  // Se trae todo lo que se ve en la grilla (incluye los días del mes anterior/siguiente que la completan).
  const cargar = () => {
    const desde = dias[0];
    const hasta = new Date(dias[dias.length - 1]);
    hasta.setDate(hasta.getDate() + 1);
    api<Publicacion[]>(`/cronopost?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`)
      .then(setPublicaciones)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el cronopost"));
  };
  useEffect(cargar, [dias]);
  const cargarCategorias = () => { api<Categoria[]>("/cronopost/categorias").then(setCategorias).catch(() => {}); };
  useEffect(() => {
    api<MiembroLite[]>("/equipo").then(setMiembros).catch(() => {});
    api<CronopostConfig>("/cronopost/configuracion").then(setConfig).catch(() => {});
    cargarCategorias();
  }, []);

  const filtradas = useMemo(
    () => publicaciones.filter((p) =>
      (filtroRed === "TODAS" || p.redes.includes(filtroRed)) && (filtroEstado === "TODOS" || p.estado === filtroEstado) &&
      (filtroCategoria === "TODAS" || (filtroCategoria === "SIN" ? !p.categoriaId : p.categoriaId === filtroCategoria))),
    [publicaciones, filtroRed, filtroEstado, filtroCategoria],
  );
  const delMes = filtradas.filter((p) => new Date(p.fecha).getMonth() === mesActual);

  const porDia = useMemo(() => {
    const m = new Map<string, Publicacion[]>();
    for (const p of filtradas) {
      const k = claveDia(new Date(p.fecha));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [filtradas]);

  const contar = (e: EstadoPublicacion[]) => delMes.filter((p) => e.includes(p.estado)).length;
  const kpis = [
    { icon: Lightbulb, titulo: "Ideas y en diseño", valor: contar(["IDEA", "DISENO"]), color: "#7c5cfc" },
    { icon: Eye, titulo: "En revisión", valor: contar(["REVISION"]), color: "#eda100" },
    { icon: CheckCircle2, titulo: "Aprobadas", valor: contar(["APROBADO"]), color: "#2a78d6" },
    { icon: Send, titulo: "Publicadas", valor: contar(["PUBLICADO"]), color: "#16a34a" },
  ];

  const tituloMes = mayuscula(cursor.toLocaleDateString("es-EC", { month: "long", year: "numeric" }));

  function exportar() {
    exportarExcel([{
      titulo: "Cronopost",
      columnas: ["Fecha", "Hora", "Categoría", "Redes", "Tipo", "Tema", "Copy", "Hashtags", "Estado", "Responsable", "Notas"],
      filas: delMes.map((p) => [
        new Date(p.fecha).toLocaleDateString("es-EC"), hora(p.fecha), p.categoria?.nombre ?? "",
        p.redes.map((r) => redInfo(r).l).join(", "), tipoInfo(p.tipo).l, p.tema, p.copy ?? "", p.hashtags ?? "",
        estadoInfo(p.estado).l, p.responsable?.user.nombre ?? "", p.notas ?? "",
      ]),
    }], `cronopost-${cursor.getFullYear()}-${dosDigitos(cursor.getMonth() + 1)}`);
  }

  async function cambiarEstado(p: Publicacion, estado: EstadoPublicacion) {
    try {
      await api(`/cronopost/${p.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function nueva(dia?: Date) {
    const fecha = new Date(dia ?? hoy);
    fecha.setHours(10, 0, 0, 0); // hora sugerida
    setEdicion({ publicacion: null, fecha });
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Cronopost</h1>
          <p className="mt-1 text-sm text-muted">Planifica las publicaciones de redes sociales: qué sale, cuándo, dónde y quién la prepara.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface hover:text-foreground" aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="w-40 text-center font-display text-sm font-semibold text-foreground">{tituloMes}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface hover:text-foreground" aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground">
            Hoy
          </button>
          <div className="flex rounded-lg border border-border p-0.5">
            {([["calendario", CalendarDays, "Calendario"], ["lista", List, "Lista"], ["configuracion", Settings2, "Configuración"]] as const).map(([v, Icon, l]) => (
              <button key={v} onClick={() => setVista(v)} title={l}
                className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition ${vista === v ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}>
                <Icon size={13} /> {l}
              </button>
            ))}
          </div>
          <button onClick={exportar} disabled={delMes.length === 0} title="Descargar el mes en Excel"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-50">
            <Download size={13} /> Excel
          </button>
          {puedeEditar && (
            <>
              <button onClick={() => setGenerarAbierto(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white">
                <Sparkles size={14} /> Generar con IA
              </button>
              <button onClick={() => nueva()} className="btn-primary px-4 py-2 text-sm">+ Nueva publicación</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />)}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
      {aviso && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{aviso}</p>}

      {vista === "configuracion" ? (
        <ConfiguracionIA puedeEditar={puedeEditar} categorias={categorias} onCategoriasCambio={() => { cargarCategorias(); cargar(); }} onGuardada={setConfig} />
      ) : (
      <>
      {/* Filtros */}
      {categorias.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Chip activo={filtroCategoria === "TODAS"} onClick={() => setFiltroCategoria("TODAS")}>Todas las categorías</Chip>
          {categorias.map((c) => (
            <Chip key={c.id} activo={filtroCategoria === c.id} color={c.color} onClick={() => setFiltroCategoria(c.id)}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: filtroCategoria === c.id ? "white" : c.color }} /> {c.nombre}
            </Chip>
          ))}
          <Chip activo={filtroCategoria === "SIN"} color={SIN_CATEGORIA_COLOR} onClick={() => setFiltroCategoria("SIN")}>Sin categoría</Chip>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip activo={filtroRed === "TODAS"} onClick={() => setFiltroRed("TODAS")}>Todas las redes</Chip>
        {REDES.map((r) => (
          <Chip key={r.v} activo={filtroRed === r.v} color={r.color} onClick={() => setFiltroRed(r.v)}>
            <r.icon size={12} /> {r.l}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip activo={filtroEstado === "TODOS"} onClick={() => setFiltroEstado("TODOS")}>Todos los estados</Chip>
        {ESTADOS.map((e) => (
          <Chip key={e.v} activo={filtroEstado === e.v} color={e.color} onClick={() => setFiltroEstado(e.v)}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: filtroEstado === e.v ? "white" : e.color }} /> {e.l}
          </Chip>
        ))}
      </div>

      {vista === "calendario" ? (
        <div className="card mt-4 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d, i) => {
              const enMes = d.getMonth() === mesActual;
              const esHoy = d.toDateString() === hoy.toDateString();
              const items = porDia.get(claveDia(d)) ?? [];
              return (
                <div key={i} className={`group min-h-[118px] border-b border-r border-border p-1.5 transition last:border-r-0 ${enMes ? "" : "bg-surface/50"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${esHoy ? "bg-primary text-white" : enMes ? "text-foreground" : "text-muted/50"}`}>
                      {d.getDate()}
                    </span>
                    {puedeEditar && (
                      <button onClick={() => nueva(d)} title="Agregar publicación este día"
                        className="flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-muted opacity-0 transition hover:bg-surface hover:text-primary group-hover:opacity-100">
                        +
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 3).map((p) => {
                      const e = estadoInfo(p.estado);
                      const color = p.categoria?.color ?? SIN_CATEGORIA_COLOR;
                      return (
                        <button key={p.id} onClick={() => setEdicion({ publicacion: p, fecha: new Date(p.fecha) })}
                          title={`${p.tema} · ${p.categoria?.nombre ?? "Sin categoría"} · ${e.l}`}
                          className="block w-full rounded-md border-l-2 px-1.5 py-1 text-left text-[10px] transition hover:brightness-95"
                          style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                          <span className="flex items-center gap-1 text-muted">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                            {hora(p.fecha)}
                            <span className="ml-auto flex gap-0.5">
                              {p.redes.slice(0, 4).map((r) => { const R = redInfo(r); return <R.icon key={r} size={9} style={{ color: R.color }} />; })}
                            </span>
                          </span>
                          <span className="block truncate font-medium text-foreground">{p.tema}</span>
                        </button>
                      );
                    })}
                    {items.length > 3 && (
                      <button onClick={() => { setVista("lista"); }} className="px-1.5 text-[10px] font-medium text-muted hover:text-primary">
                        +{items.length - 3} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card mt-4 overflow-hidden overflow-x-auto p-0">
          {delMes.length === 0 ? (
            <div className="p-6"><EmptyState texto="No hay publicaciones este mes con esos filtros." /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>{["Fecha", "Categoría", "Redes", "Tipo", "Tema", "Estado", "Responsable"].map((c) => <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {delMes.map((p) => {
                  const T = tipoInfo(p.tipo);
                  return (
                    <tr key={p.id} onClick={() => setEdicion({ publicacion: p, fecha: new Date(p.fecha) })} className="cursor-pointer hover:bg-surface/60">
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">
                        {mayuscula(new Date(p.fecha).toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" }))}
                        <span className="ml-1.5 text-xs text-muted">{hora(p.fecha)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{p.categoria ? <CategoriaBadge c={p.categoria} /> : <span className="text-xs text-muted">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="flex gap-1">{p.redes.map((r) => { const R = redInfo(r); return <R.icon key={r} size={14} style={{ color: R.color }} aria-label={R.l} />; })}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted"><span className="inline-flex items-center gap-1"><T.icon size={13} /> {T.l}</span></td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="truncate font-medium text-foreground">{p.tema}</p>
                        {p.copy && <p className="truncate text-xs text-muted">{p.copy}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {puedeEditar ? (
                          <select value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value as EstadoPublicacion)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs" style={{ color: estadoInfo(p.estado).color }}>
                            {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
                          </select>
                        ) : <EstadoBadge estado={p.estado} />}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{p.responsable?.user.nombre ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      </>
      )}

      {generarAbierto && (
        <GenerarPlanModal
          mes={cursor}
          config={config}
          categorias={categorias}
          miembros={miembros}
          onClose={() => setGenerarAbierto(false)}
          onIrAConfiguracion={() => { setGenerarAbierto(false); setVista("configuracion"); }}
          onGuardado={(creadas) => {
            setGenerarAbierto(false);
            setVista("calendario");
            setAviso(`Se agregaron ${creadas} publicación(es) al cronopost como "Idea". Revísalas y pásalas a diseño.`);
            cargar();
          }}
        />
      )}

      {edicion && (
        <ModalPublicacion
          edicion={edicion}
          miembros={miembros}
          puedeEditar={puedeEditar}
          tonoInicial={config?.tono ?? "CERCANO"}
          categorias={categorias}
          onClose={() => setEdicion(null)}
          onGuardado={() => { setEdicion(null); cargar(); }}
        />
      )}
    </AppShell>
  );
}

function Chip({ activo, color, onClick, children }: { activo: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
        activo ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"} ${activo && !color ? "bg-primary" : ""}`}
      style={activo && color ? { backgroundColor: color } : undefined}>
      {children}
    </button>
  );
}

function CategoriaBadge({ c }: { c: { nombre: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: c.color, backgroundColor: `color-mix(in srgb, ${c.color} 12%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.nombre}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: EstadoPublicacion }) {
  const e = estadoInfo(estado);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: e.color, backgroundColor: `color-mix(in srgb, ${e.color} 12%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} /> {e.l}
    </span>
  );
}

const CAMPO = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-70";
const ETIQUETA = "mb-1 block text-xs font-medium text-foreground";

function ModalPublicacion({
  edicion, miembros, puedeEditar, tonoInicial, categorias, onClose, onGuardado,
}: { edicion: Edicion; miembros: MiembroLite[]; puedeEditar: boolean; tonoInicial: TonoCopy; categorias: Categoria[]; onClose: () => void; onGuardado: () => void }) {
  const p = edicion.publicacion;
  const [fecha, setFecha] = useState(fechaInput(edicion.fecha));
  const [horaPub, setHoraPub] = useState(horaInput(edicion.fecha));
  const [redes, setRedes] = useState<RedSocial[]>(p?.redes ?? ["FACEBOOK", "INSTAGRAM"]);
  const [tipo, setTipo] = useState<TipoPieza>(p?.tipo ?? "IMAGEN");
  const [tema, setTema] = useState(p?.tema ?? "");
  const [copy, setCopy] = useState(p?.copy ?? "");
  const [hashtags, setHashtags] = useState(p?.hashtags ?? "");
  const [estado, setEstado] = useState<EstadoPublicacion>(p?.estado ?? "IDEA");
  const [responsableId, setResponsableId] = useState(p?.responsableId ?? "");
  const [categoriaId, setCategoriaId] = useState(p?.categoriaId ?? "");
  const [notas, setNotas] = useState(p?.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Panel de IA
  const [iaAbierta, setIaAbierta] = useState(false);
  const [objetivo, setObjetivo] = useState("");
  const [tono, setTono] = useState<TonoCopy>(tonoInicial);
  const [generando, setGenerando] = useState(false);
  const [opciones, setOpciones] = useState<{ copy: string; hashtags: string }[]>([]);

  const limite = limiteCopy(redes);
  const excede = limite !== null && copy.length > limite;

  function alternarRed(r: RedSocial) {
    setRedes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function generar() {
    setError(null);
    setGenerando(true);
    setOpciones([]);
    try {
      const r = await api<{ opciones: { copy: string; hashtags: string }[] }>("/cronopost/generar-copy", {
        method: "POST",
        body: JSON.stringify({ tema, objetivo: objetivo || undefined, redes, tipo, tono, categoriaId: categoriaId || undefined }),
      });
      setOpciones(r.opciones);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el copy");
    } finally {
      setGenerando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (redes.length === 0) return setError("Elige al menos una red.");
    setError(null);
    setGuardando(true);
    const body = {
      fecha: new Date(`${fecha}T${horaPub}:00`).toISOString(),
      redes, tipo, tema: tema.trim(), copy, hashtags, estado,
      responsableId: responsableId || null, categoriaId: categoriaId || null, notas,
    };
    try {
      await api(p ? `/cronopost/${p.id}` : "/cronopost", { method: p ? "PATCH" : "POST", body: JSON.stringify(body) });
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!p || !(await confirmDialog(`¿Eliminar "${p.tema}" del cronopost?`, { titulo: "¿Eliminar publicación?", textoConfirmar: "Eliminar" }))) return;
    try {
      await api(`/cronopost/${p.id}`, { method: "DELETE" });
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            {p ? (puedeEditar ? "Editar publicación" : "Publicación") : "Nueva publicación"}
          </h2>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={guardar} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <fieldset disabled={!puedeEditar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 block sm:col-span-1"><span className={ETIQUETA}>Fecha</span>
                <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} /></label>
              <label className="block"><span className={ETIQUETA}>Hora</span>
                <input type="time" required value={horaPub} onChange={(e) => setHoraPub(e.target.value)} className={CAMPO} /></label>
              <label className="block"><span className={ETIQUETA}>Tipo de pieza</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPieza)} className={CAMPO}>
                  {TIPOS_PIEZA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select></label>
              <label className="col-span-2 block sm:col-span-1"><span className={ETIQUETA}>Estado</span>
                <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoPublicacion)} className={CAMPO}>
                  {ESTADOS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select></label>
            </div>

            <div>
              <span className={ETIQUETA}>Redes</span>
              <div className="flex flex-wrap gap-1.5">
                {REDES.map((r) => {
                  const activa = redes.includes(r.v);
                  return (
                    <button type="button" key={r.v} onClick={() => alternarRed(r.v)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${activa ? "text-white ring-transparent" : "bg-card text-muted ring-border hover:text-foreground"}`}
                      style={activa ? { backgroundColor: r.color } : undefined}>
                      <r.icon size={12} /> {r.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
              <label className="block"><span className={ETIQUETA}>Categoría</span>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={CAMPO}>
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></label>
              <label className="block"><span className={ETIQUETA}>Tema</span>
                <input required maxLength={160} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej. Lanzamiento del crédito para emprendedores" className={CAMPO} /></label>
            </div>

            {puedeEditar && (
              <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
                <button type="button" onClick={() => setIaAbierta((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-medium text-primary">
                  <Sparkles size={15} /> Generar copy con IA
                  <ChevronRight size={14} className={`ml-auto transition ${iaAbierta ? "rotate-90" : ""}`} />
                </button>
                {iaAbierta && (
                  <div className="mt-3 space-y-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
                      <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={300}
                        placeholder="Objetivo (opcional), ej. que visiten la agencia más cercana" className={CAMPO} />
                      <select value={tono} onChange={(e) => setTono(e.target.value as TonoCopy)} className={CAMPO} aria-label="Tono">
                        {TONOS.map((t) => <option key={t.v} value={t.v}>Tono {t.l.toLowerCase()}</option>)}
                      </select>
                    </div>
                    <p className="text-[11px] text-muted">Se envían a la IA solo el tema y el objetivo: no escribas datos de socios ni prospectos.</p>
                    <button type="button" onClick={generar} disabled={generando || tema.trim().length < 3 || redes.length === 0}
                      className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
                      {generando ? <><Loader2 size={13} className="animate-spin" /> Generando…</> : <><Sparkles size={13} /> Proponer 3 copies</>}
                    </button>
                    {opciones.length > 0 && (
                      <div className="space-y-2">
                        {opciones.map((o, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card p-3 text-sm">
                            <p className="whitespace-pre-wrap text-foreground">{o.copy}</p>
                            <p className="mt-1.5 text-xs text-primary">{o.hashtags}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[11px] text-muted">{o.copy.length} caracteres</span>
                              <button type="button" onClick={() => { setCopy(o.copy); setHashtags(o.hashtags); }}
                                className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white">
                                Usar este
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-medium text-foreground">
                Copy
                {limite !== null && (
                  <span className={excede ? "text-red-600" : "text-muted"}>
                    {copy.length} / {limite}{excede ? " — demasiado largo para alguna de las redes elegidas" : ""}
                  </span>
                )}
              </span>
              <textarea rows={6} value={copy} onChange={(e) => setCopy(e.target.value)} maxLength={5000} placeholder="Texto de la publicación" className={CAMPO} />
            </label>
            <label className="block"><span className={ETIQUETA}>Hashtags</span>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} maxLength={500} placeholder="#Cooperativa #Ahorro" className={CAMPO} /></label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block"><span className={ETIQUETA}>Responsable</span>
                <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className={CAMPO}>
                  <option value="">Sin asignar</option>
                  {miembros.map((m) => <option key={m.id} value={m.id}>{m.user.nombre}</option>)}
                </select></label>
              <label className="block"><span className={ETIQUETA}>Notas internas</span>
                <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={2000} placeholder="Ej. usar fotos de la agencia Ibarra" className={CAMPO} /></label>
            </div>
          </fieldset>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}

          {puedeEditar && (
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <button disabled={guardando} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                {guardando ? "Guardando…" : p ? "Guardar cambios" : "Agregar al cronopost"}
              </button>
              <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancelar</button>
              {p && (
                <button type="button" onClick={eliminar} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          )}
          {!puedeEditar && (
            <p className="flex items-center gap-1.5 text-xs text-muted"><Clock size={12} /> Vista de solo lectura.</p>
          )}
        </form>
      </div>
    </div>
  );
}
