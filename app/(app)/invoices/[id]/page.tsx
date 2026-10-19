import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings, session } from "@/lib/session";
import type { Client, Invoice, InvoiceLine } from "@/lib/types";
import { paymentLabel } from "@/lib/os";
import { daysBetween, formatDate, formatMoneyExact, todayISO } from "@/lib/format";
import { ErrorNote, InvoiceBadge } from "@/components/OS";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelInvoice, deleteDraft, duplicateInvoice, issueInvoice, markPaid, unmarkPaid } from "../actions";

export const metadata: Metadata = { title: "Factura" };

export default async function InvoicePage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; ok?: string } }) {
  const { supabase } = await session();
  const [{ data: inv }, { data: lineRows }, settings] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", params.id).order("sort"),
    getSettings(supabase),
  ]);
  if (!inv) notFound();
  const i = inv as Invoice;
  const lines = (lineRows ?? []) as InvoiceLine[];
  const { data: cData } = await supabase.from("clients").select("*").eq("id", i.client_id).maybeSingle();
  const client = cData as Client | null;
  const today = todayISO();
  const late = i.status === "emitida" && i.due_date < today;

  const missing = [
    !settings.legal_name && "vuestra razón social",
    !settings.nif && "vuestro NIF",
    !settings.address && "vuestra dirección",
    !client?.nif && "NIF del cliente",
    !client?.address && "dirección del cliente",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/invoices" className="text-xs font-medium text-graphite hover:text-violet">← Facturas</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tabular-nums sm:text-3xl">{i.number ?? "Borrador de factura"}</h1>
              <InvoiceBadge status={i.status} overdue={late} />
            </div>
            <p className="mt-1 text-sm text-graphite">
              <Link href={`/clients/${i.client_id}?tab=facturas`} className="text-violet hover:underline">
                {i.client_name ?? client?.name ?? "Cliente"}
              </Link>
              {" · "}
              {formatMoneyExact(i.total)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {i.status !== "borrador" && (
              <a href={`/print/invoices/${i.id}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Ver / descargar PDF
              </a>
            )}
            <form action={duplicateInvoice.bind(null, i.id)}>
              <SubmitButton className="btn-secondary" pendingText="Duplicando…">Duplicar</SubmitButton>
            </form>
          </div>
        </div>
        {searchParams.error && <ErrorNote>{searchParams.error}</ErrorNote>}
        {searchParams.ok === "emitida" && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Factura {i.number} emitida. Ábrela para descargar el PDF y enviarla al cliente.
          </p>
        )}
      </header>

      {i.status === "borrador" ? (
        <>
          {missing.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Para emitir falta: {missing.join(", ")}.{" "}
              <Link href="/settings" className="font-medium underline">Ajustes</Link> ·{" "}
              <Link href={`/clients/${i.client_id}/edit`} className="font-medium underline">Cliente</Link>
            </p>
          )}
          <InvoiceEditor
            id={i.id}
            iban={settings.iban}
            canIssue={missing.length === 0 && lines.length > 0}
            issueAction={issueInvoice.bind(null, i.id)}
            initial={{
              issue_date: i.issue_date,
              due_date: i.due_date,
              payment_method: i.payment_method,
              payment_note: i.payment_note ?? "",
              notes: i.notes ?? "",
              period: i.period ?? "",
              vat_rate: Number(i.vat_rate),
              irpf_rate: Number(i.irpf_rate),
              lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
            }}
          />
          <form action={deleteDraft.bind(null, i.id)} className="text-right">
            <ConfirmButton message="¿Borrar este borrador?" className="text-xs font-medium text-red-600 hover:underline">
              Borrar borrador
            </ConfirmButton>
          </form>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="card overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="px-5 py-3 font-medium">Concepto</th>
                  <th className="px-3 py-3 text-right font-medium">Cant.</th>
                  <th className="px-3 py-3 text-right font-medium">Precio</th>
                  <th className="px-5 py-3 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3">{l.description}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(l.quantity).toLocaleString("es-ES")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoneyExact(l.unit_price)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoneyExact(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t border-line p-5 text-sm">
              <dt className="text-graphite">Base imponible</dt>
              <dd className="text-right tabular-nums">{formatMoneyExact(i.subtotal)}</dd>
              <dt className="text-graphite">IVA {Number(i.vat_rate)}%</dt>
              <dd className="text-right tabular-nums">{formatMoneyExact(i.vat_amount)}</dd>
              {Number(i.irpf_rate) > 0 && (
                <>
                  <dt className="text-graphite">IRPF −{Number(i.irpf_rate)}%</dt>
                  <dd className="text-right tabular-nums">−{formatMoneyExact(i.irpf_amount)}</dd>
                </>
              )}
              <dt className="border-t border-line pt-2 font-semibold">Total</dt>
              <dd className="border-t border-line pt-2 text-right font-semibold tabular-nums">{formatMoneyExact(i.total)}</dd>
            </dl>
          </section>

          <aside className="space-y-4">
            <section className="card space-y-2 p-5 text-sm">
              <p className="flex justify-between"><span className="text-graphite">Emitida</span>{formatDate(i.issue_date)}</p>
              <p className="flex justify-between">
                <span className="text-graphite">Vence</span>
                <span className={late ? "font-medium text-red-600" : ""}>
                  {formatDate(i.due_date)}
                  {late && ` (hace ${daysBetween(i.due_date, today)} días)`}
                </span>
              </p>
              <p className="flex justify-between"><span className="text-graphite">Forma de pago</span>{paymentLabel(i.payment_method)}</p>
              {i.paid_at && (
                <p className="flex justify-between text-emerald-700">
                  <span>Cobrada</span>
                  {formatDate(i.paid_at)} · {formatMoneyExact(i.paid_amount)}
                </p>
              )}
            </section>

            {i.status === "emitida" && (
              <form action={markPaid.bind(null, i.id)} className="card space-y-3 p-5">
                <h2 className="section-title">Registrar cobro</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="paid_at" className="label">Fecha</label>
                    <input id="paid_at" name="paid_at" type="date" defaultValue={today} className="input" />
                  </div>
                  <div>
                    <label htmlFor="paid_amount" className="label">Importe (€)</label>
                    <input id="paid_amount" name="paid_amount" type="number" step="0.01" min="0" defaultValue={Number(i.total)} className="input" />
                  </div>
                </div>
                <SubmitButton className="btn-primary w-full" pendingText="Guardando…">Marcar como cobrada</SubmitButton>
              </form>
            )}
            {i.status === "cobrada" && (
              <form action={unmarkPaid.bind(null, i.id)}>
                <ConfirmButton message="¿Volver a dejarla pendiente de cobro?" className="btn-secondary w-full">Deshacer cobro</ConfirmButton>
              </form>
            )}
            {i.status === "emitida" && (
              <form action={cancelInvoice.bind(null, i.id)} className="px-1">
                <ConfirmButton
                  message={`¿Anular la factura ${i.number}? Se conserva con su número y deja de contar. Para corregirla, emite otra.`}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Anular factura
                </ConfirmButton>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
