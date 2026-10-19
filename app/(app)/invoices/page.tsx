import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import type { Invoice } from "@/lib/types";
import { currentPeriod, daysBetween, formatDate, formatMoneyExact, todayISO } from "@/lib/format";
import { Empty, InvoiceBadge } from "@/components/OS";
import { SubmitButton } from "@/components/SubmitButton";
import { generateMonthlyInvoices } from "./actions";

export const metadata: Metadata = { title: "Facturas" };

const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "borrador", label: "Borradores" },
  { value: "pendientes", label: "Pendientes de cobro" },
  { value: "vencidas", label: "Vencidas" },
  { value: "cobrada", label: "Cobradas" },
  { value: "anulada", label: "Anuladas" },
];

type SP = { status?: string; year?: string; ok?: string };

function Kpi({ label, value, tone, href }: { label: string; value: string; tone?: "red" | "violet"; href?: string }) {
  const inner = (
    <>
      <p className="text-xs font-medium text-graphite">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : tone === "violet" ? "text-violet" : ""}`}>{value}</p>
    </>
  );
  return href ? <Link href={href} className="card block p-4 hover:border-violet/40">{inner}</Link> : <div className="card p-4">{inner}</div>;
}

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const { supabase } = await session();
  const status = FILTERS.some((f) => f.value === searchParams.status) ? searchParams.status! : "todas";
  const today = todayISO();
  const year = /^\d{4}$/.test(searchParams.year ?? "") ? Number(searchParams.year) : Number(today.slice(0, 4));

  const [{ data }, { data: clients }] = await Promise.all([
    supabase.from("invoices").select("*").order("issue_date", { ascending: false }).order("seq", { ascending: false, nullsFirst: true }).limit(1000),
    supabase.from("clients").select("id, name"),
  ]);
  const all = (data ?? []) as Invoice[];
  const names = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name as string]));

  const pending = all.filter((i) => i.status === "emitida");
  const overdue = pending.filter((i) => i.due_date < today);
  const month = today.slice(0, 7);
  const sum = (xs: Invoice[], k: "total" | "subtotal" | "paid_amount" = "total") => xs.reduce((s, i) => s + Number(i[k] ?? 0), 0);
  const paidThisMonth = all.filter((i) => i.status === "cobrada" && i.paid_at?.startsWith(month));
  const billedYear = all.filter((i) => (i.status === "emitida" || i.status === "cobrada") && i.issue_date.startsWith(String(year)));

  let list = all.filter((i) => status === "borrador" || i.status === "borrador" || i.issue_date.startsWith(String(year)));
  if (status === "borrador") list = all.filter((i) => i.status === "borrador");
  else if (status === "pendientes") list = pending;
  else if (status === "vencidas") list = overdue;
  else if (status === "cobrada" || status === "anulada") list = list.filter((i) => i.status === status);

  const years = Array.from(new Set(all.map((i) => Number(i.issue_date.slice(0, 4))).concat(Number(today.slice(0, 4))))).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Facturas</h1>
          <p className="mt-1 text-sm text-graphite">Borradores, emitidas y cobros. Las emitidas quedan numeradas y bloqueadas.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form action={generateMonthlyInvoices} className="flex items-end gap-2">
            <div>
              <label htmlFor="period" className="label">Cuotas del mes</label>
              <input id="period" name="period" type="month" defaultValue={currentPeriod()} className="input w-auto py-1.5" />
            </div>
            <SubmitButton className="btn-secondary py-1.5" pendingText="Creando…">Crear borradores</SubmitButton>
          </form>
          <Link href="/invoices/new" className="btn-primary">+ Nueva factura</Link>
        </div>
      </header>

      {searchParams.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{searchParams.ok}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pendiente de cobro" value={formatMoneyExact(sum(pending))} href="/invoices?status=pendientes" />
        <Kpi label={`Vencido (${overdue.length})`} value={formatMoneyExact(sum(overdue))} tone={overdue.length ? "red" : undefined} href="/invoices?status=vencidas" />
        <Kpi label="Cobrado este mes" value={formatMoneyExact(sum(paidThisMonth, "paid_amount"))} />
        <Kpi label={`Facturado en ${year} (base)`} value={formatMoneyExact(sum(billedYear, "subtotal"))} tone="violet" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Estado">
          {FILTERS.map((f) => (
            <Link key={f.value} href={`/invoices?status=${f.value}&year=${year}`} aria-current={status === f.value ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${status === f.value ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <select name="year" defaultValue={year} aria-label="Año" className="input w-auto py-1.5">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-secondary py-1.5">Ver</button>
          <a href={`/api/export/invoices?year=${year}`} className="btn-secondary py-1.5">Exportar CSV para la gestoría</a>
        </form>
      </div>

      {list.length === 0 ? (
        <section className="card px-6"><Empty title="No hay facturas con este filtro." /></section>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-graphite">
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Emisión</th>
                <th className="px-3 py-3 font-medium">Vencimiento</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((i) => {
                const late = i.status === "emitida" && i.due_date < today;
                return (
                  <tr key={i.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3 font-medium tabular-nums">
                      <Link href={`/invoices/${i.id}`} className="hover:text-violet">{i.number ?? "Borrador"}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/clients/${i.client_id}?tab=facturas`} className="hover:text-violet">{i.client_name ?? names[i.client_id] ?? "—"}</Link>
                    </td>
                    <td className="px-3 py-3 text-graphite">{formatDate(i.issue_date)}</td>
                    <td className={`px-3 py-3 ${late ? "font-medium text-red-600" : "text-graphite"}`}>
                      {formatDate(i.due_date)}
                      {late && <span className="block text-xs">hace {daysBetween(i.due_date, today)} días</span>}
                      {i.status === "cobrada" && i.paid_at && <span className="block text-xs text-emerald-700">cobrada el {formatDate(i.paid_at)}</span>}
                    </td>
                    <td className="px-3 py-3"><InvoiceBadge status={i.status} overdue={late} /></td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoneyExact(i.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
