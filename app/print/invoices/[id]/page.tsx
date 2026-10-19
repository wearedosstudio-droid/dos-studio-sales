import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings, session } from "@/lib/session";
import type { Client, Invoice, InvoiceLine, Settings } from "@/lib/types";
import { monthLabel, paymentLabel } from "@/lib/os";
import { formatDateNumeric, formatMoneyExact } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Factura" };

function addressLines(o: { address?: string | null; postal_code?: string | null; city?: string | null; province?: string | null; country?: string | null }) {
  return [o.address, [o.postal_code, o.city].filter(Boolean).join(" "), [o.province, o.country].filter(Boolean).join(", ")].filter(
    (x): x is string => Boolean(x),
  );
}

/** Plantilla de factura A4 con la marca. "Descargar PDF" usa el diálogo de impresión del navegador. */
export default async function PrintInvoicePage({ params }: { params: { id: string } }) {
  const { supabase } = await session();
  const [{ data: inv }, { data: lineRows }, live] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", params.id).order("sort"),
    getSettings(supabase),
  ]);
  if (!inv) notFound();
  const i = inv as Invoice;
  const lines = (lineRows ?? []) as InvoiceLine[];
  const draft = i.status === "borrador";

  // Emitida: datos congelados al emitir. Borrador: datos actuales.
  const issuer: Settings = (i.issuer as Settings | null) ?? live;
  let client = {
    name: i.client_legal_name ?? i.client_name ?? "",
    nif: i.client_nif,
    lines: (i.client_address ?? "").split("\n").filter(Boolean),
  };
  if (draft || !i.client_nif) {
    const { data: c } = await supabase.from("clients").select("*").eq("id", i.client_id).maybeSingle();
    const cc = c as Client | null;
    if (cc) client = { name: cc.legal_name ?? cc.name, nif: cc.nif, lines: addressLines(cc) };
  }

  return (
    <div className="min-h-screen bg-canvas py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0 } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/invoices/${i.id}`} className="text-sm font-medium text-graphite hover:text-violet">← Volver</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-graphite">Elige «Guardar como PDF» en el destino.</span>
          <PrintButton />
        </div>
      </div>

      <article className="relative mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-white px-[16mm] py-[16mm] text-[10.5pt] text-ink shadow-sm print:shadow-none">
        {draft && (
          <p className="pointer-events-none absolute inset-0 grid place-content-center text-[64pt] font-bold uppercase tracking-widest text-ink/[0.05] [transform:rotate(-24deg)]">
            Borrador
          </p>
        )}

        <header className="flex items-start justify-between gap-8">
          <div className="flex items-center gap-3">
            <Image src="/brand/isotype.png" alt="" width={40} height={46} priority />
            <div>
              <p className="font-display text-[20pt] font-bold leading-none tracking-tight">
                {issuer.trade_name ?? "Dos Studio"}<span className="text-violet">.</span>
              </p>
              <p className="mt-1 text-[7.5pt] font-medium uppercase tracking-[0.3em] text-violet">Digital Marketing</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-[22pt] font-bold uppercase leading-none tracking-tight">Factura</p>
            <p className="mt-2 font-medium tabular-nums">{draft ? "Sin número (borrador)" : `Nº ${i.number}`}</p>
          </div>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-1.5 text-[7.5pt] font-semibold uppercase tracking-widest text-graphite">Emisor</p>
            <p className="font-semibold">{issuer.legal_name ?? "— Razón social pendiente —"}</p>
            <p>NIF {issuer.nif ?? "—"}</p>
            {addressLines(issuer).map((l) => <p key={l}>{l}</p>)}
            {issuer.email && <p>{issuer.email}</p>}
            {issuer.phone && <p>{issuer.phone}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-[7.5pt] font-semibold uppercase tracking-widest text-graphite">Cliente</p>
            <p className="font-semibold">{client.name}</p>
            <p>NIF {client.nif ?? "—"}</p>
            {client.lines.map((l) => <p key={l}>{l}</p>)}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-3 gap-4 rounded-lg bg-canvas px-5 py-3 print:bg-[#F7F6FB]">
          <div>
            <p className="text-[7.5pt] uppercase tracking-widest text-graphite">Fecha de emisión</p>
            <p className="font-medium tabular-nums">{formatDateNumeric(i.issue_date)}</p>
          </div>
          <div>
            <p className="text-[7.5pt] uppercase tracking-widest text-graphite">Vencimiento</p>
            <p className="font-medium tabular-nums">{formatDateNumeric(i.due_date)}</p>
          </div>
          <div>
            <p className="text-[7.5pt] uppercase tracking-widest text-graphite">{i.period ? "Periodo" : "Forma de pago"}</p>
            <p className="font-medium capitalize">{i.period ? monthLabel(i.period) : paymentLabel(i.payment_method)}</p>
          </div>
        </section>

        <table className="mt-8 w-full">
          <thead>
            <tr className="border-b-2 border-ink text-left text-[7.5pt] uppercase tracking-widest">
              <th className="py-2 font-semibold">Concepto</th>
              <th className="w-16 py-2 text-right font-semibold">Cant.</th>
              <th className="w-28 py-2 text-right font-semibold">Precio</th>
              <th className="w-28 py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line align-top">
                <td className="py-2.5 pr-4">{l.description}</td>
                <td className="py-2.5 text-right tabular-nums">{Number(l.quantity).toLocaleString("es-ES")}</td>
                <td className="py-2.5 text-right tabular-nums">{formatMoneyExact(l.unit_price)}</td>
                <td className="py-2.5 text-right tabular-nums">{formatMoneyExact(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <dl className="grid w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
            <dt>Base imponible</dt>
            <dd className="text-right tabular-nums">{formatMoneyExact(i.subtotal)}</dd>
            <dt>IVA ({Number(i.vat_rate)}%)</dt>
            <dd className="text-right tabular-nums">{formatMoneyExact(i.vat_amount)}</dd>
            {Number(i.irpf_rate) > 0 && (
              <>
                <dt>Retención IRPF ({Number(i.irpf_rate)}%)</dt>
                <dd className="text-right tabular-nums">−{formatMoneyExact(i.irpf_amount)}</dd>
              </>
            )}
            <dt className="mt-1 border-t-2 border-ink pt-2 font-display text-[13pt] font-bold">Total</dt>
            <dd className="mt-1 border-t-2 border-ink pt-2 text-right font-display text-[13pt] font-bold tabular-nums">{formatMoneyExact(i.total)}</dd>
          </dl>
        </section>

        <section className="mt-10 space-y-1.5 border-l-2 border-violet pl-4">
          <p className="text-[7.5pt] font-semibold uppercase tracking-widest text-graphite">Forma de pago</p>
          <p>
            {paymentLabel(i.payment_method)} · vencimiento {formatDateNumeric(i.due_date)}
          </p>
          {i.payment_method === "transferencia" && issuer.iban && <p className="font-medium tabular-nums">IBAN {issuer.iban}</p>}
          {i.payment_note && <p>{i.payment_note}</p>}
        </section>

        {i.notes && <p className="mt-6 whitespace-pre-line">{i.notes}</p>}

        <footer className="mt-auto pt-10 text-[7.5pt] leading-relaxed text-graphite">
          {issuer.invoice_footer && <p className="whitespace-pre-line">{issuer.invoice_footer}</p>}
          {i.status === "anulada" && <p className="mt-2 font-semibold text-red-700">FACTURA ANULADA</p>}
        </footer>
      </article>
    </div>
  );
}
