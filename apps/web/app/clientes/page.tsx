"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

interface Cliente {
  id: string;
  tipoIdentificacion: string;
  identificacion: string;
  razonSocial: string;
  email?: string | null;
  telefono?: string | null;
}

const TIPOS = [
  { v: "CEDULA", l: "Cédula" },
  { v: "RUC", l: "RUC" },
  { v: "PASAPORTE", l: "Pasaporte" },
  { v: "CONSUMIDOR_FINAL", l: "Consumidor final" },
];

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = () => api<Cliente[]>("/clientes").then(setClientes).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/clientes", {
        method: "POST",
        body: JSON.stringify({
          tipoIdentificacion: f.get("tipoIdentificacion"),
          identificacion: f.get("identificacion"),
          razonSocial: f.get("razonSocial"),
          email: f.get("email") || undefined,
          telefono: f.get("telefono") || undefined,
          direccion: f.get("direccion") || undefined,
        }),
      });
      setAbierto(false);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <button onClick={() => setAbierto(!abierto)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {abierto ? "Cancelar" : "+ Nuevo cliente"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {abierto && (
        <form onSubmit={crear} className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <Select name="tipoIdentificacion" label="Tipo">
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </Select>
          <Field name="identificacion" label="Identificación" required />
          <Field name="razonSocial" label="Razón social" required className="col-span-2" />
          <Field name="email" label="Email" type="email" />
          <Field name="telefono" label="Teléfono" />
          <Field name="direccion" label="Dirección" className="col-span-2" />
          <button className="col-span-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">Guardar</button>
        </form>
      )}

      <Tabla
        cols={["Identificación", "Razón social", "Email", "Teléfono"]}
        filas={clientes.map((c) => [c.identificacion, c.razonSocial, c.email ?? "—", c.telefono ?? "—"])}
        vacio="Aún no tienes clientes"
      />
    </AppShell>
  );
}

export function Field({ label, className = "", ...p }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <input {...p} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand" />
    </label>
  );
}

export function Select({ label, children, className = "", ...p }: { label: string; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <select {...p} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand">
        {children}
      </select>
    </label>
  );
}

export function Tabla({ cols, filas, vacio }: { cols: string[]; filas: React.ReactNode[][]; vacio: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400">
          <tr>{cols.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {filas.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-zinc-400">{vacio}</td></tr>
          ) : (
            filas.map((fila, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                {fila.map((celda, j) => <td key={j} className="px-4 py-3">{celda}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
