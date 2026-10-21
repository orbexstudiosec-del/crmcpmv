"use client";

import { useEffect, useState } from "react";
import { Users, ShieldAlert, Building2, MapPin, Trash2, Pencil, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Kpi } from "@/components/crm-widgets";
import { confirmDialog } from "@/components/confirm-dialog";
import { api, leerSesion, type Sesion } from "@/lib/api";
import { Field, Select } from "@/app/clientes/page";

interface Departamento {
  id: string;
  nombre: string;
}

interface Sucursal {
  id: string;
  nombre: string;
  ciudad?: string | null;
  _count?: { leads: number; miembros: number };
}

interface Miembro {
  id: string;
  rol: string;
  createdAt: string;
  departamento: Departamento | null;
  sucursal: Sucursal | null;
  user: { id: string; nombre: string; email: string; emailVerified: string | null };
}

const ROLES = [
  { v: "OWNER", l: "Administrador" },
  { v: "ADMIN", l: "Coadministrador" },
  { v: "SUPERVISOR", l: "Jefe de agencia" },
  { v: "AGENTE", l: "Agente" },
  { v: "RIESGOS", l: "Analista de riesgos" },
  { v: "GERENCIA", l: "Gerencia (solo lectura)" },
];
const rolLabel = (v: string) => ROLES.find((r) => r.v === v)?.l ?? v;

export default function EquipoPage() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const esAdmin = ["OWNER", "ADMIN"].includes(sesion?.rol ?? "");

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevoDepto, setNuevoDepto] = useState("");
  const [nuevaSucursal, setNuevaSucursal] = useState("");
  const [nuevaSucursalCiudad, setNuevaSucursalCiudad] = useState("");
  const [cargandoMiembros, setCargandoMiembros] = useState(true);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [enviadoId, setEnviadoId] = useState<string | null>(null);
  const [restableciendoId, setRestableciendoId] = useState<string | null>(null);
  const [restablecidoId, setRestablecidoId] = useState<string | null>(null);
  const [deptoNuevoMiembro, setDeptoNuevoMiembro] = useState("");
  const [sucursalNuevoMiembro, setSucursalNuevoMiembro] = useState("");
  const [editandoMiembro, setEditandoMiembro] = useState<Miembro | null>(null);

  const cargar = () => {
    api<Miembro[]>("/equipo").then(setMiembros).catch((e) => setError(e.message)).finally(() => setCargandoMiembros(false));
    api<Departamento[]>("/departamentos").then(setDepartamentos).catch(() => {});
    api<Sucursal[]>("/sucursales").then(setSucursales).catch(() => {});
  };
  useEffect(() => { setSesion(leerSesion()); cargar(); }, []);

  async function crearMiembro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/equipo", {
        method: "POST",
        body: JSON.stringify({
          nombre: f.get("nombre"),
          email: f.get("email"),
          password: f.get("password"),
          rol: f.get("rol"),
          departamentoId: deptoNuevoMiembro || undefined,
          sucursalId: sucursalNuevoMiembro || undefined,
        }),
      });
      setAbierto(false);
      setDeptoNuevoMiembro("");
      setSucursalNuevoMiembro("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  async function crearDepartamentoInline(nombre: string): Promise<Departamento | null> {
    try {
      const d = await api<Departamento>("/departamentos", { method: "POST", body: JSON.stringify({ nombre }) });
      setDepartamentos((prev) => [...prev, d].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return d;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return null;
    }
  }

  async function crearSucursalInline(nombre: string): Promise<Sucursal | null> {
    try {
      const s = await api<Sucursal>("/sucursales", { method: "POST", body: JSON.stringify({ nombre }) });
      setSucursales((prev) => [...prev, s].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return null;
    }
  }

  async function actualizarUsuario(id: string, cambios: { nombre?: string; email?: string }) {
    try {
      await api(`/equipo/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function reenviarVerificacion(id: string) {
    setReenviandoId(id);
    setEnviadoId(null);
    try {
      await api(`/equipo/${id}/reenviar-verificacion`, { method: "POST" });
      setEnviadoId(id);
      setTimeout(() => setEnviadoId((v) => (v === id ? null : v)), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setReenviandoId(null);
    }
  }

  async function restablecerPassword(id: string, nombre: string) {
    if (!(await confirmDialog(`Se le va a mandar a ${nombre} un correo para que elija una contraseña nueva.`, { titulo: "¿Restablecer contraseña?", textoConfirmar: "Enviar correo", peligroso: false }))) return;
    setRestableciendoId(id);
    setRestablecidoId(null);
    try {
      await api(`/equipo/${id}/restablecer-password`, { method: "POST" });
      setRestablecidoId(id);
      setTimeout(() => setRestablecidoId((v) => (v === id ? null : v)), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setRestableciendoId(null);
    }
  }

  async function verificarEmail(id: string) {
    const ok = await confirmDialog(
      "Esto marca el correo como verificado sin que la persona haya hecho clic en el enlace que le llegó por correo. Úsalo solo si confirmaste por otro medio que el correo es correcto y le pertenece a esta persona, o si el correo nunca le llegó y necesitas desbloquearla manualmente.",
      { titulo: "¿Verificar manualmente?", textoConfirmar: "Verificar manualmente", peligroso: false },
    );
    if (!ok) return;
    try {
      await api(`/equipo/${id}/verificar-email`, { method: "PATCH" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function cambiarRol(id: string, rol: string) {
    try {
      await api(`/equipo/${id}`, { method: "PATCH", body: JSON.stringify({ rol }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function cambiarDepartamento(id: string, departamentoId: string) {
    try {
      await api(`/equipo/${id}`, { method: "PATCH", body: JSON.stringify({ departamentoId: departamentoId || null }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function cambiarSucursal(id: string, sucursalId: string) {
    try {
      await api(`/equipo/${id}`, { method: "PATCH", body: JSON.stringify({ sucursalId: sucursalId || null }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function quitarMiembro(id: string) {
    if (!(await confirmDialog("¿Quitar a este miembro de la organización?"))) return;
    try {
      await api(`/equipo/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function crearDepartamento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nuevoDepto.trim()) return;
    setError(null);
    try {
      await api("/departamentos", { method: "POST", body: JSON.stringify({ nombre: nuevoDepto.trim() }) });
      setNuevoDepto("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function eliminarDepartamento(id: string) {
    if (!(await confirmDialog("¿Eliminar este departamento? Los miembros quedarán sin departamento."))) return;
    try {
      await api(`/departamentos/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function crearSucursal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nuevaSucursal.trim()) return;
    setError(null);
    try {
      await api("/sucursales", { method: "POST", body: JSON.stringify({ nombre: nuevaSucursal.trim(), ciudad: nuevaSucursalCiudad.trim() || undefined }) });
      setNuevaSucursal("");
      setNuevaSucursalCiudad("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  /** Cambiar la ciudad de una agencia solo afecta a los leads que entren desde ahora. */
  async function cambiarCiudadSucursal(s: Sucursal, ciudad: string) {
    if (ciudad.trim() === (s.ciudad ?? "")) return;
    try {
      await api(`/sucursales/${s.id}`, { method: "PATCH", body: JSON.stringify({ ciudad: ciudad.trim() || null }) });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function eliminarSucursal(id: string) {
    if (!(await confirmDialog("¿Eliminar esta agencia? Sus miembros y sus leads quedarán sin agencia."))) return;
    try {
      await api(`/sucursales/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  const sinVerificar = miembros.filter((m) => !m.user.emailVerified).length;
  const kpis = [
    { icon: Users, titulo: "Miembros", valor: miembros.length, color: "var(--color-chart-1)" },
    { icon: ShieldAlert, titulo: "Sin verificar", valor: sinVerificar, color: "var(--color-status-warning)" },
    { icon: Building2, titulo: "Departamentos", valor: departamentos.length, color: "var(--color-chart-2)" },
    { icon: MapPin, titulo: "Agencias", valor: sucursales.length, color: "var(--color-chart-3)" },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Equipo</h1>
          <p className="mt-1 text-sm text-muted">Roles, departamentos y agencias.</p>
        </div>
        {esAdmin && (
          <button onClick={() => setAbierto(!abierto)} className="btn-primary px-4 py-2 text-sm">
            {abierto ? "Cancelar" : "+ Agregar miembro"}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.titulo} icon={k.icon} titulo={k.titulo} valor={k.valor} tendencia={null} color={k.color} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Departamentos */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Building2 size={17} className="text-muted" /> Departamentos
          </h2>
          <p className="text-sm text-muted">Área funcional, ej. &ldquo;Ventas&rdquo;, &ldquo;Soporte&rdquo;.</p>
          {departamentos.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aún no tienes departamentos.</p>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-lg ring-1 ring-border">
              {departamentos.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-foreground">{d.nombre}</span>
                  {esAdmin && (
                    <button onClick={() => eliminarDepartamento(d.id)} className="text-muted hover:text-red-600" aria-label={`Eliminar ${d.nombre}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {esAdmin && (
            <form onSubmit={crearDepartamento} className="mt-4 flex gap-2 border-t border-border pt-4">
              <input
                value={nuevoDepto}
                onChange={(e) => setNuevoDepto(e.target.value)}
                placeholder="Nombre del departamento"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button className="btn btn-outline shrink-0 px-4 py-2 text-sm">Agregar</button>
            </form>
          )}
        </section>

        {/* Agencias */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <MapPin size={17} className="text-muted" /> Agencias
          </h2>
          <p className="text-sm text-muted">Los leads se envían solos a la agencia que atiende su ciudad. Si varias comparten ciudad, se reparten entre ellas.</p>
          {sucursales.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aún no tienes agencias.</p>
          ) : (
            <div className="mt-4 max-h-80 divide-y divide-border overflow-y-auto rounded-lg ring-1 ring-border">
              {sucursales.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{s.nombre}</p>
                    <p className="text-[11px] text-muted">{s._count?.leads ?? 0} lead(s) · {s._count?.miembros ?? 0} miembro(s)</p>
                  </div>
                  {esAdmin ? (
                    <input
                      defaultValue={s.ciudad ?? ""}
                      onBlur={(e) => cambiarCiudadSucursal(s, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      placeholder="Ciudad"
                      aria-label={`Ciudad de ${s.nombre}`}
                      className={`w-32 shrink-0 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:border-primary ${s.ciudad ? "border-border" : "border-amber-300"}`}
                    />
                  ) : (
                    <span className="shrink-0 text-xs text-muted">{s.ciudad ?? "Sin ciudad"}</span>
                  )}
                  {esAdmin && (
                    <button onClick={() => eliminarSucursal(s.id)} className="shrink-0 text-muted hover:text-red-600" aria-label={`Eliminar ${s.nombre}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {esAdmin && (
            <form onSubmit={crearSucursal} className="mt-4 flex gap-2 border-t border-border pt-4">
              <input
                value={nuevaSucursal}
                onChange={(e) => setNuevaSucursal(e.target.value)}
                placeholder="Nombre de la agencia"
                className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={nuevaSucursalCiudad}
                onChange={(e) => setNuevaSucursalCiudad(e.target.value)}
                placeholder="Ciudad"
                className="w-32 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button className="btn btn-outline shrink-0 px-4 py-2 text-sm">Agregar</button>
            </form>
          )}
        </section>
      </div>
      {/* Alta de miembro */}
      {abierto && esAdmin && (
        <form onSubmit={crearMiembro} className="card mt-6 grid grid-cols-2 gap-3 p-5">
          <Field name="nombre" label="Nombre" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="password" label="Contraseña temporal" type="password" required />
          <Select name="rol" label="Rol" defaultValue="AGENTE">
            {ROLES.filter((r) => r.v !== "OWNER").map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </Select>
          <SelectConCrear
            label="Departamento (opcional)"
            value={deptoNuevoMiembro}
            onChange={setDeptoNuevoMiembro}
            opciones={departamentos}
            placeholder="Sin departamento"
            onCrear={crearDepartamentoInline}
          />
          <SelectConCrear
            label="Agencia (opcional)"
            value={sucursalNuevoMiembro}
            onChange={setSucursalNuevoMiembro}
            opciones={sucursales}
            placeholder="Sin agencia"
            onCrear={crearSucursalInline}
          />
          <button disabled={guardando} className="col-span-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
            {guardando ? "Guardando…" : "Agregar al equipo"}
          </button>
        </form>
      )}

      {/* Miembros */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-foreground">Miembros</h2>
        <div className="mt-3 overflow-hidden overflow-x-auto rounded-2xl bg-card shadow-sm ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {["Nombre", "Email", "Verificación", "Rol", "Departamento", "Agencia", ""].map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargandoMiembros ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Cargando…</td></tr>
              ) : miembros.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Aún no tienes miembros en el equipo</td></tr>
              ) : (
                miembros.map((m) => (
                  <tr key={m.id} className="hover:bg-surface/60">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{m.user.nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{m.user.email}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {m.user.emailVerified ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                          Verificado
                        </span>
                      ) : esAdmin ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                            Sin verificar
                          </span>
                          <div className="flex items-center gap-2 text-[11px]">
                            {enviadoId === m.id ? (
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">Correo reenviado ✓</span>
                            ) : (
                              <button
                                onClick={() => reenviarVerificacion(m.id)}
                                disabled={reenviandoId === m.id}
                                className="font-medium text-primary hover:underline disabled:opacity-50"
                              >
                                {reenviandoId === m.id ? "Enviando…" : "Reenviar correo"}
                              </button>
                            )}
                            <span className="text-muted">·</span>
                            <button
                              onClick={() => verificarEmail(m.id)}
                              title="Verificar manualmente, sin que la persona haga clic en el correo"
                              className="font-medium text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
                            >
                              Verificar manualmente
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                          Sin verificar
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {esAdmin ? (
                        <select
                          value={m.rol}
                          onChange={(e) => cambiarRol(m.id, e.target.value)}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        >
                          {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                        </select>
                      ) : (
                        <span className="badge-pill">{rolLabel(m.rol)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {esAdmin ? (
                        <SelectConCrear
                          compact
                          value={m.departamento?.id ?? ""}
                          onChange={(id) => cambiarDepartamento(m.id, id)}
                          opciones={departamentos}
                          placeholder="Sin departamento"
                          onCrear={crearDepartamentoInline}
                        />
                      ) : (
                        m.departamento?.nombre ?? "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {esAdmin ? (
                        <SelectConCrear
                          compact
                          value={m.sucursal?.id ?? ""}
                          onChange={(id) => cambiarSucursal(m.id, id)}
                          opciones={sucursales}
                          placeholder="Sin agencia"
                          onCrear={crearSucursalInline}
                        />
                      ) : (
                        m.sucursal?.nombre ?? "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {esAdmin && (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setEditandoMiembro(m)}
                            title="Editar nombre o correo"
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          {restablecidoId === m.id ? (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Correo enviado ✓</span>
                          ) : (
                            <button
                              onClick={() => restablecerPassword(m.id, m.user.nombre)}
                              disabled={restableciendoId === m.id}
                              title="Mandarle un correo para que elija una contraseña nueva"
                              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                            >
                              {restableciendoId === m.id ? "Enviando…" : "Restablecer contraseña"}
                            </button>
                          )}
                          <button onClick={() => quitarMiembro(m.id)} className="text-xs font-medium text-red-600 hover:underline">
                            Quitar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editandoMiembro && (
        <EditarMiembroModal
          miembro={editandoMiembro}
          onClose={() => setEditandoMiembro(null)}
          onGuardar={async (cambios) => {
            await actualizarUsuario(editandoMiembro.id, cambios);
            setEditandoMiembro(null);
          }}
        />
      )}
    </AppShell>
  );
}

function EditarMiembroModal({
  miembro, onClose, onGuardar,
}: {
  miembro: Miembro;
  onClose: () => void;
  onGuardar: (cambios: { nombre: string; email: string }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(miembro.user.nombre);
  const [email, setEmail] = useState(miembro.user.email);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), email: email.trim() });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-sm p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Editar miembro</h2>
          <button onClick={onClose} className="shrink-0 text-muted hover:text-foreground" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={guardar} className="flex flex-col gap-3 p-5">
          <Field label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button disabled={guardando || !nombre.trim() || !email.trim()} className="btn-primary mt-2 py-2 text-sm disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Select con opción de crear un departamento/sucursal nuevo sin salir de donde estás — antes
 * la única forma era ir arriba a la sección dedicada, y era fácil no notar que el que buscabas
 * ya existía y terminar creando uno repetido (ambos endpoints igual bloquean nombres duplicados,
 * pero el error solo se ve si alcanzás a leer el banner rojo). */
function SelectConCrear({
  value, onChange, opciones, placeholder, onCrear, label, compact,
}: {
  value: string;
  onChange: (id: string) => void;
  opciones: { id: string; nombre: string }[];
  placeholder: string;
  onCrear: (nombre: string) => Promise<{ id: string } | null>;
  label?: string;
  compact?: boolean;
}) {
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  const inputClass = compact
    ? "w-24 min-w-0 rounded-lg border border-primary bg-background px-2 py-1 text-xs outline-none"
    : "w-full rounded-lg border border-primary bg-background px-3 py-2 text-sm outline-none";
  const selectClass = compact
    ? "rounded-lg border border-border bg-background px-2 py-1 text-xs"
    : "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  async function confirmarCreacion() {
    const n = nombreNuevo.trim();
    if (!n) { setCreando(false); return; }
    setGuardandoNuevo(true);
    const creado = await onCrear(n);
    setGuardandoNuevo(false);
    if (creado) { onChange(creado.id); setCreando(false); setNombreNuevo(""); }
  }

  // No usar <form> acá: este componente se usa dentro de otros <form> (alta de miembro), y
  // <form> anidado es HTML inválido — el navegador rompe el DOM y el submit deja de funcionar.
  const contenido = creando ? (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={nombreNuevo}
        onChange={(e) => setNombreNuevo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); confirmarCreacion(); }
          else if (e.key === "Escape") { setCreando(false); setNombreNuevo(""); }
        }}
        placeholder="Nombre nuevo…"
        disabled={guardandoNuevo}
        className={inputClass}
      />
      <button type="button" onClick={confirmarCreacion} disabled={guardandoNuevo} title="Crear" className="shrink-0 text-sm font-bold text-primary disabled:opacity-50">✓</button>
      <button type="button" onClick={() => { setCreando(false); setNombreNuevo(""); }} title="Cancelar" className="shrink-0 text-muted hover:text-foreground">×</button>
    </div>
  ) : (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nuevo__") { setCreando(true); return; }
        onChange(e.target.value);
      }}
      className={selectClass}
    >
      <option value="">{placeholder}</option>
      {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      <option value="__nuevo__">+ Nuevo…</option>
    </select>
  );

  if (!label) return contenido;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {contenido}
    </label>
  );
}
