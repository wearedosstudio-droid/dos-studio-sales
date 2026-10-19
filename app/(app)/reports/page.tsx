import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam, personName } from "@/lib/team";
import type { Client, Invoice } from "@/lib/types";
import { ACTIVE_PHASES, MONTHS } from "@/lib/os";
import { PIPELINE_STATUSES, statusLabel } from "@/lib/constants";
import { addDaysISO, addMonths, currentPeriod, daysBetween, formatMinutes, formatMoney, todayISO } from "@/lib/format";
import { Avatar, Empty } from "@/components/OS";

export const metadata: Metadata = { title: "Informes" };

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "red" | "violet" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-graphite">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : tone === "violet" ? "text-violet" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-graphite">{sub}</p>}
    </div>
  );
}

function HBar({ label, value, max, display, href, tone = "bg-violet" }: { label: string; value: number; max: number; display: string; href?: string; tone?: string }) {
  const name = href ? <Link href={href} className="truncate hover:text-violet">{label}</Link> : <span className="truncate">{label}</span>;
  return (
    <li className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
      {name}
      <span className="h-2.5 overflow-hidden rounded-full bg-canvas">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="text-right tabular-nums">{display}</span>
    </li>
  );
}

export default async function ReportsPage() {
  const { supabase, me } = await session();
  const today = todayISO();
  const period = currentPeriod();
  const from12 = `${addMonths(period, -11)}-01`;

  const [{ data: cData }, { data: iData }, { data: coData }, { data: tData }, { data: teData }, team] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("invoices").select("*").neq("status", "borrador").neq("status", "anulada"),
    supabase.from("companies").select("status, potential_value"),
    supabase.from("tasks").select("assignee_id, due_date, client_id").eq("status", "pendiente"),
    supabase.from("time_entries").select("client_id, user_id, minutes, work_date").gte("work_date", `${period}-01`),
    getTeam(supabase),
  ]);
  const clients = (cData ?? []) as Client[];
  const invoices = (iData ?? []) as Invoice[];
  const companies = coData ?? [];
  const tasks = tData ?? [];
  const time = teData ?? [];
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  // Ingresos recurrentes
  const active = clients.filter((c) => (ACTIVE_PHASES as string[]).includes(c.phase));
  const mrr = active.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);
  const withFee = active.filter((c) => Number(c.monthly_fee) > 0);

  // Facturado y cobrado por mes (base imponible, últimos 12 meses)
  const months = Array.from({ length: 12 }, (_, k) => addMonths(period, k - 11));
  const billed = months.map((m) => invoices.filter((i) => i.issue_date.startsWith(m)).reduce((s, i) => s + Number(i.subtotal), 0));
  const collected = months.map((m) => invoices.filter((i) => i.status === "cobrada" && i.paid_at?.startsWith(m)).reduce((s, i) => s + Number(i.subtotal), 0));
  const maxMonth = Math.max(1, ...billed, ...collected);
  const billed12 = billed.reduce((a, b) => a + b, 0);
  const collected12 = collected.reduce((a, b) => a + b, 0);

  // Deuda por antigüedad
  const pending = invoices.filter((i) => i.status === "emitida");
  const buckets = [
    { label: "Sin vencer", test: (d: number) => d <= 0, tone: "bg-emerald-500" },
    { label: "1–30 días", test: (d: number) => d >= 1 && d <= 30, tone: "bg-amber-400" },
    { label: "31–60 días", test: (d: number) => d >= 31 && d <= 60, tone: "bg-orange-500" },
    { label: "Más de 60 días", test: (d: number) => d > 60, tone: "bg-red-600" },
  ].map((b) => {
    const xs = pending.filter((i) => b.test(daysBetween(i.due_date, today)));
    return { ...b, amount: xs.reduce((s, i) => s + Number(i.total), 0), n: xs.length };
  });
  const debtTotal = pending.reduce((s, i) => s + Number(i.total), 0);
  const overdueTotal = pending.filter((i) => i.due_date < today).reduce((s, i) => s + Number(i.total), 0);
  const debtors = Object.entries(
    pending.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.client_id]: (acc[i.client_id] ?? 0) + Number(i.total) }), {}),
  ).sort((a, b) => b[1] - a[1]);

  // Ingresos por cliente y por servicio (12 meses, base)
  const last12 = invoices.filter((i) => i.issue_date >= from12);
  const byClient = Object.entries(
    last12.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.client_id]: (acc[i.client_id] ?? 0) + Number(i.subtotal) }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const byService = Object.entries(
    last12.reduce<Record<string, number>>((acc, i) => {
      const s = clients.find((c) => c.id === i.client_id)?.service ?? "Sin servicio";
      return { ...acc, [s]: (acc[s] ?? 0) + Number(i.subtotal) };
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const topShare = billed12 && byClient[0] ? Math.round((byClient[0][1] / billed12) * 100) : 0;

  // Embudo comercial
  const funnel = PIPELINE_STATUSES.map((s) => ({ s, n: companies.filter((c) => c.status === s).length }));
  const won = companies.filter((c) => c.status === "ganado").length;
  const lost = companies.filter((c) => c.status === "perdido").length;
  const conversion = won + lost ? Math.round((won / (won + lost)) * 100) : null;
  const openValue = companies
    .filter((c) => ["reunion", "propuesta", "negociacion"].includes(c.status))
    .reduce((s, c) => s + Number(c.potential_value ?? 0), 0);
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.n));

  // Rentabilidad del mes
  const minutesBy = time.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.client_id]: (acc[t.client_id] ?? 0) + t.minutes }), {});
  const profit = withFee
    .map((c) => {
      const min = minutesBy[c.id] ?? 0;
      return { c, min, perHour: min ? Number(c.monthly_fee) / (min / 60) : null };
    })
    .sort((a, b) => (a.perHour ?? Infinity) - (b.perHour ?? Infinity));

  // Carga por socio
  const load = Object.values(team).map((p) => {
    const mine = tasks.filter((t) => t.assignee_id === p.id);
    const owned = active.filter((c) => c.owner_id === p.id);
    return {
      p,
      open: mine.length,
      late: mine.filter((t) => t.due_date < today).length,
      clients: owned.length,
      mrr: owned.reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0),
      minutes: time.filter((t) => t.user_id === p.id).reduce((s, t) => s + t.minutes, 0),
    };
  });

  // Clientes que necesitan atención
  const soon = addDaysISO(today, 30);
  const risk = active
    .map((c) => {
      const reasons: string[] = [];
      const late = tasks.filter((t) => t.client_id === c.id && t.due_date < today).length;
      if (late >= 2) reasons.push(`${late} tareas vencidas`);
      const debt = pending.filter((i) => i.client_id === c.id && i.due_date < today);
      if (debt.length) reasons.push(`${debt.length} ${debt.length === 1 ? "factura vencida" : "facturas vencidas"}`);
      if (c.min_months) {
        const end = `${addMonths(c.start_date.slice(0, 7), c.min_months)}-01`;
        if (end >= today && end <= soon) reasons.push("permanencia termina este mes: hablad de renovación");
      }
      if (Number(c.monthly_fee) > 0 && !invoices.some((i) => i.client_id === c.id && i.issue_date >= `${addMonths(period, -1)}-01`) && c.phase !== "onboarding") {
        reasons.push("sin facturar en el último mes");
      }
      return { c, reasons };
    })
    .filter((r) => r.reasons.length);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Informes</h1>
        <p className="mt-1 text-sm text-graphite">Importes sin IVA salvo la deuda, que incluye IVA porque es lo que os tienen que pagar.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ingresos recurrentes (MRR)" value={formatMoney(mrr)} sub={`${withFee.length} clientes con cuota · ${formatMoney(mrr * 12)} al año`} tone="violet" />
        <Kpi label="Facturado 12 meses" value={formatMoney(billed12)} sub={`Cobrado: ${formatMoney(collected12)}`} />
        <Kpi label="Pendiente de cobro" value={formatMoney(debtTotal)} sub={overdueTotal ? `${formatMoney(overdueTotal)} vencido` : "Nada vencido"} tone={overdueTotal ? "red" : undefined} />
        <Kpi label="Cuota media" value={withFee.length ? formatMoney(mrr / withFee.length) : "—"} />
        <Kpi label="Conversión comercial" value={conversion === null ? "—" : `${conversion}%`} sub={`${won} ganados · ${lost} perdidos`} />
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="section-title">Facturado y cobrado por mes</h2>
          <p className="flex gap-4 text-xs text-graphite">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet" />Facturado</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Cobrado</span>
          </p>
        </div>
        {billed12 + collected12 === 0 ? (
          <Empty title="Aún no hay facturas emitidas.">El gráfico se llenará en cuanto emitáis y cobréis las primeras.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-12 items-end gap-2" style={{ height: 200 }}>
              {months.map((m, k) => (
                <div key={m} className="flex h-full flex-col justify-end">
                  <div className="flex h-full items-end justify-center gap-0.5">
                    <span title={`Facturado ${formatMoney(billed[k])}`} className="w-1/2 max-w-[18px] rounded-t bg-violet" style={{ height: `${(billed[k] / maxMonth) * 100}%`, minHeight: billed[k] ? 2 : 0 }} />
                    <span title={`Cobrado ${formatMoney(collected[k])}`} className="w-1/2 max-w-[18px] rounded-t bg-emerald-500" style={{ height: `${(collected[k] / maxMonth) * 100}%`, minHeight: collected[k] ? 2 : 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid min-w-[560px] grid-cols-12 gap-2 text-center text-[11px] text-graphite">
              {months.map((m) => (
                <span key={m} className={m === period ? "font-semibold text-ink" : ""}>
                  {MONTHS[Number(m.slice(5)) - 1].slice(0, 3)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-graphite">Máximo del periodo: {formatMoney(maxMonth)}. Pasa el ratón por una barra para ver su importe.</p>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="section-title mb-4">Deuda por antigüedad</h2>
          {debtTotal === 0 ? (
            <Empty title="No hay nada pendiente de cobro." />
          ) : (
            <>
              <ul className="space-y-2.5">
                {buckets.map((b) => (
                  <HBar key={b.label} label={`${b.label} (${b.n})`} value={b.amount} max={debtTotal} display={formatMoney(b.amount)} tone={b.tone} />
                ))}
              </ul>
              <h3 className="section-title mb-2 mt-6">Quién os debe</h3>
              <ul className="divide-y divide-line text-sm">
                {debtors.slice(0, 6).map(([id, amount]) => (
                  <li key={id} className="flex justify-between py-2">
                    <Link href={`/clients/${id}?tab=facturas`} className="hover:text-violet">{name(id)}</Link>
                    <span className="tabular-nums">{formatMoney(amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="section-title mb-4">Ingresos por cliente · 12 meses</h2>
          {byClient.length === 0 ? (
            <Empty title="Sin facturación todavía." />
          ) : (
            <>
              <ul className="space-y-2.5">
                {byClient.slice(0, 8).map(([id, v]) => (
                  <HBar key={id} label={name(id)} value={v} max={byClient[0][1]} display={formatMoney(v)} href={`/clients/${id}`} />
                ))}
              </ul>
              {topShare >= 40 && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {name(byClient[0][0])} supone el {topShare}% de la facturación: perderlo os dejaría muy expuestos.
                </p>
              )}
              <h3 className="section-title mb-2 mt-6">Por servicio</h3>
              <ul className="space-y-2.5">
                {byService.map(([s, v]) => (
                  <HBar key={s} label={s} value={v} max={byService[0][1]} display={formatMoney(v)} tone="bg-ink" />
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="section-title">Embudo comercial</h2>
            {openValue > 0 && <span className="text-xs text-graphite">{formatMoney(openValue)} en juego</span>}
          </div>
          <ul className="space-y-2.5">
            {funnel.map((f) => (
              <HBar key={f.s} label={statusLabel(f.s)} value={f.n} max={maxFunnel} display={String(f.n)} href={`/companies?status=${f.s}`} tone={f.s === "ganado" ? "bg-emerald-500" : "bg-violet"} />
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="section-title mb-4">Carga del equipo</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-graphite">
                  <th className="pb-2 font-medium">Socio</th>
                  <th className="pb-2 text-right font-medium">Clientes</th>
                  <th className="pb-2 text-right font-medium">Cuotas</th>
                  <th className="pb-2 text-right font-medium">Tareas</th>
                  <th className="pb-2 text-right font-medium">Horas mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {load.map((l) => (
                  <tr key={l.p.id}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2"><Avatar team={team} id={l.p.id} me={me} />{personName(team, l.p.id, me)}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{l.clients}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(l.mrr)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {l.open}
                      {l.late > 0 && <span className="text-red-600"> ({l.late} venc.)</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatMinutes(l.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="section-title mb-1">Rentabilidad de {MONTHS[Number(period.slice(5)) - 1]}</h2>
        <p className="mb-4 text-xs text-graphite">Cuota dividida entre las horas registradas este mes. Los de arriba son los que menos rinden por hora.</p>
        {profit.length === 0 ? (
          <Empty title="Sin clientes con cuota." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-graphite">
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 text-right font-medium">Cuota</th>
                  <th className="pb-2 text-right font-medium">Horas</th>
                  <th className="pb-2 text-right font-medium">€ por hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profit.map(({ c, min, perHour }) => (
                  <tr key={c.id}>
                    <td className="py-2.5"><Link href={`/clients/${c.id}?tab=horas`} className="hover:text-violet">{c.name}</Link></td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(c.monthly_fee)}</td>
                    <td className="py-2.5 text-right tabular-nums">{min ? formatMinutes(min) : <span className="text-graphite">Sin registrar</span>}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{perHour ? `${formatMoney(perHour)}/h` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="section-title mb-4">Clientes que necesitan atención</h2>
        {risk.length === 0 ? (
          <Empty title="Todo en orden." />
        ) : (
          <ul className="divide-y divide-line">
            {risk.map(({ c, reasons }) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <Link href={`/clients/${c.id}`} className="font-medium hover:text-violet">{c.name}</Link>
                <span className="text-right text-amber-800">{reasons.join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
