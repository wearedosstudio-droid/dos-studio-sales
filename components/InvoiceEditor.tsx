"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS } from "@/lib/os";
import type { DraftInput } from "@/app/(app)/invoices/actions";
import { saveDraft } from "@/app/(app)/invoices/actions";

type Line = { key: number; description: string; quantity: string; unit_price: string };

const money = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const toNum = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));
const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Editor de borradores: fechas, forma de pago, conceptos y totales en vivo. */
export function InvoiceEditor({
  id,
  initial,
  iban,
  canIssue,
  issueAction,
}: {
  id: string;
  initial: DraftInput;
  iban: string | null;
  canIssue: boolean;
  issueAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [issuing, startIssue] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const [f, setF] = useState({
    issue_date: initial.issue_date,
    due_date: initial.due_date,
    payment_method: initial.payment_method,
    payment_note: initial.payment_note,
    notes: initial.notes,
    period: initial.period,
    vat_rate: String(initial.vat_rate),
    irpf_rate: String(initial.irpf_rate),
  });
  const [lines, setLines] = useState<Line[]>(
    (initial.lines.length ? initial.lines : [{ description: "", quantity: 1, unit_price: 0 }]).map((l, i) => ({
      key: i,
      description: l.description,
      quantity: String(l.quantity),
      unit_price: String(l.unit_price),
    })),
  );
  const [nextKey, setNextKey] = useState(lines.length);

  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const setLine = (key: number, k: keyof Line, v: string) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: v } : l)));
    setDirty(true);
  };

  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((s, l) => s + round2(toNum(l.quantity) * toNum(l.unit_price) || 0), 0));
    const vat = round2((subtotal * (toNum(f.vat_rate) || 0)) / 100);
    const irpf = round2((subtotal * (toNum(f.irpf_rate) || 0)) / 100);
    return { subtotal, vat, irpf, total: round2(subtotal + vat - irpf) };
  }, [lines, f.vat_rate, f.irpf_rate]);

  const termDays = Math.round((Date.parse(f.due_date) - Date.parse(f.issue_date)) / 86_400_000);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveDraft(id, {
        ...f,
        vat_rate: toNum(f.vat_rate),
        irpf_rate: toNum(f.irpf_rate),
        lines: lines.map((l) => ({ description: l.description, quantity: toNum(l.quantity), unit_price: toNum(l.unit_price) })),
      });
      if (res.error) setMsg({ kind: "error", text: res.error });
      else {
        setMsg({ kind: "ok", text: "Borrador guardado." });
        setDirty(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="issue_date" className="label">Fecha de emisión</label>
          <input id="issue_date" type="date" value={f.issue_date} onChange={(e) => set("issue_date", e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor="due_date" className="label">Vencimiento</label>
          <input id="due_date" type="date" value={f.due_date} min={f.issue_date} onChange={(e) => set("due_date", e.target.value)} className="input" />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[0, 7, 15, 30, 60].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("due_date", addDays(f.issue_date, d))}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${termDays === d ? "bg-violet text-white" : "bg-canvas text-graphite hover:text-ink"}`}
              >
                {d === 0 ? "Al contado" : `${d} días`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="payment_method" className="label">Forma de pago</label>
          <select id="payment_method" value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)} className="input">
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {f.payment_method === "transferencia" && (
            <p className="mt-1 text-[11px] text-graphite">{iban ? `Se mostrará el IBAN ${iban}.` : "Añade vuestro IBAN en Ajustes."}</p>
          )}
        </div>
        <div>
          <label htmlFor="period" className="label">Periodo facturado</label>
          <input id="period" type="month" value={f.period} onChange={(e) => set("period", e.target.value)} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="payment_note" className="label">Nota de pago (opcional)</label>
          <input id="payment_note" value={f.payment_note} maxLength={500} onChange={(e) => set("payment_note", e.target.value)} placeholder="Indicar el número de factura en el concepto de la transferencia" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="label">Observaciones en la factura (opcional)</label>
          <input id="notes" value={f.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} className="input" />
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-graphite">
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="w-24 px-2 py-3 text-right font-medium">Cantidad</th>
              <th className="w-32 px-2 py-3 text-right font-medium">Precio (€)</th>
              <th className="w-32 px-2 py-3 text-right font-medium">Importe</th>
              <th className="w-10 px-2 py-3"><span className="sr-only">Quitar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l) => (
              <tr key={l.key}>
                <td className="px-4 py-2">
                  <input value={l.description} maxLength={500} onChange={(e) => setLine(l.key, "description", e.target.value)} aria-label="Concepto" placeholder="Gestión de redes sociales · noviembre 2026" className="input" />
                </td>
                <td className="px-2 py-2">
                  <input value={l.quantity} inputMode="decimal" onChange={(e) => setLine(l.key, "quantity", e.target.value)} aria-label="Cantidad" className="input text-right tabular-nums" />
                </td>
                <td className="px-2 py-2">
                  <input value={l.unit_price} inputMode="decimal" onChange={(e) => setLine(l.key, "unit_price", e.target.value)} aria-label="Precio unitario" className="input text-right tabular-nums" />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{money(round2(toNum(l.quantity) * toNum(l.unit_price)))}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls));
                      setDirty(true);
                    }}
                    aria-label="Quitar concepto"
                    className="text-graphite hover:text-red-600"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-line p-4">
          <button
            type="button"
            onClick={() => {
              setLines((ls) => [...ls, { key: nextKey, description: "", quantity: "1", unit_price: "0" }]);
              setNextKey((k) => k + 1);
              setDirty(true);
            }}
            className="btn-secondary"
          >
            + Añadir concepto
          </button>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-graphite">Base imponible</dt>
            <dd className="text-right tabular-nums">{money(totals.subtotal)}</dd>
            <dt className="flex items-center gap-2 text-graphite">
              IVA
              <input value={f.vat_rate} inputMode="decimal" onChange={(e) => set("vat_rate", e.target.value)} aria-label="Tipo de IVA" className="input w-16 py-0.5 text-right" />%
            </dt>
            <dd className="text-right tabular-nums">{money(totals.vat)}</dd>
            <dt className="flex items-center gap-2 text-graphite">
              IRPF
              <input value={f.irpf_rate} inputMode="decimal" onChange={(e) => set("irpf_rate", e.target.value)} aria-label="Retención de IRPF" className="input w-16 py-0.5 text-right" />%
            </dt>
            <dd className="text-right tabular-nums">{totals.irpf ? `−${money(totals.irpf)}` : money(0)}</dd>
            <dt className="border-t border-line pt-2 font-semibold">Total</dt>
            <dd className="border-t border-line pt-2 text-right font-display text-lg font-semibold tabular-nums">{money(totals.total)}</dd>
          </dl>
        </div>
      </section>

      {msg && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-xs text-amber-700">Hay cambios sin guardar.</span>}
        <a href={`/print/invoices/${id}`} target="_blank" rel="noopener noreferrer" className={`btn-secondary ${dirty ? "pointer-events-none opacity-50" : ""}`}>
          Vista previa
        </a>
        <button type="button" onClick={save} disabled={pending} className="btn-secondary">
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
        <button
          type="button"
          disabled={dirty || !canIssue || issuing}
          title={dirty ? "Guarda antes de emitir" : !canIssue ? "Faltan datos fiscales o conceptos" : undefined}
          onClick={() => {
            if (!window.confirm("Al emitir, la factura recibe su número y ya no se puede modificar. ¿Emitir ahora?")) return;
            startIssue(() => issueAction());
          }}
          className="btn-primary"
        >
          {issuing ? "Emitiendo…" : "Emitir factura"}
        </button>
      </div>
    </div>
  );
}
