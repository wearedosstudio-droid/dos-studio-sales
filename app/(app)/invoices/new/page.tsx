import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { currentPeriod } from "@/lib/format";
import { ErrorNote } from "@/components/OS";
import { SubmitButton } from "@/components/SubmitButton";
import { createInvoice } from "../actions";

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NewInvoicePage({ searchParams }: { searchParams: { client?: string; error?: string } }) {
  const { supabase } = await session();
  const { data: clients } = await supabase.from("clients").select("id, name, monthly_fee, phase").neq("phase", "cerrado").order("name");

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link href="/invoices" className="text-xs font-medium text-graphite hover:text-violet">← Facturas</Link>
        <h1 className="mt-2 text-2xl font-semibold">Nueva factura</h1>
        <p className="mt-1 text-sm text-graphite">Se crea como borrador con las condiciones del cliente. Podrás cambiar conceptos, vencimiento y forma de pago antes de emitirla.</p>
      </header>
      {searchParams.error === "cliente" && <ErrorNote>Elige un cliente.</ErrorNote>}
      {searchParams.error === "crear" && <ErrorNote>No se pudo crear la factura.</ErrorNote>}
      {!clients?.length ? (
        <p className="card p-5 text-sm">
          Primero crea un cliente. <Link href="/clients/new" className="text-violet hover:underline">Nuevo cliente</Link>
        </p>
      ) : (
        <form action={createInvoice} className="card space-y-5 p-5">
          <div>
            <label htmlFor="client_id" className="label">Cliente</label>
            <select id="client_id" name="client_id" defaultValue={searchParams.client ?? ""} required className="input">
              <option value="" disabled>Elige un cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.monthly_fee ? ` · cuota ${Number(c.monthly_fee).toLocaleString("es-ES")} €` : ""}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="label">Plantilla</legend>
            <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-violet has-[:checked]:bg-violet-soft/40">
              <input type="radio" name="kind" value="cuota" defaultChecked className="mt-0.5 accent-violet" />
              <span>
                <span className="font-medium">Cuota mensual</span>
                <span className="block text-xs text-graphite">Un concepto con el servicio y la cuota del cliente para el mes elegido.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-violet has-[:checked]:bg-violet-soft/40">
              <input type="radio" name="kind" value="manual" className="mt-0.5 accent-violet" />
              <span>
                <span className="font-medium">En blanco</span>
                <span className="block text-xs text-graphite">Para webs, auditorías, extras o pagos únicos.</span>
              </span>
            </label>
          </fieldset>
          <div>
            <label htmlFor="period" className="label">Mes de la cuota</label>
            <input id="period" name="period" type="month" defaultValue={currentPeriod()} className="input w-auto" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText="Creando…">Crear borrador</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
