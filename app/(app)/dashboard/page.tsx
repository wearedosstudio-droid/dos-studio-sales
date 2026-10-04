import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLOSED_STATUSES, PIPELINE_STATUSES, statusLabel, type Status } from "@/lib/constants";
import { addDaysISO, followUpLabel, formatMoney, todayISO } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Dashboard" };

type Row = {
  id: string;
  name: string;
  status: Status;
  priority: string;
  potential_value: number | null;
  next_follow_up_at: string | null;
  follow_up_note: string | null;
};

function Metric({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`card block p-4 transition hover:border-violet/40 ${accent ? "border-violet/30 bg-violet-soft/40" : ""}`}
    >
      <p className="text-xs font-medium text-graphite">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${accent ? "text-violet" : ""}`}>{value}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, status, priority, potential_value, next_follow_up_at, follow_up_note");

  const companies = (data ?? []) as Row[];
  const today = todayISO();
  const inAWeek = addDaysISO(today, 7);

  const count = (s: Status) => companies.filter((c) => c.status === s).length;
  const byStatus = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s, count(s)])) as Record<Status, number>;
  const maxStage = Math.max(1, ...PIPELINE_STATUSES.map((s) => byStatus[s]));

  // Valor abierto: empresas en reunión, propuesta o negociación con valor indicado.
  const openValue = companies
    .filter((c) => ["reunion", "propuesta", "negociacion"].includes(c.status))
    .reduce((sum, c) => sum + (c.potential_value ?? 0), 0);

  const followUps = companies
    .filter(
      (c) =>
        c.next_follow_up_at &&
        c.next_follow_up_at <= inAWeek &&
        !CLOSED_STATUSES.includes(c.status) &&
        c.status !== "pausado",
    )
    .sort((a, b) => (a.next_follow_up_at! < b.next_follow_up_at! ? -1 : 1));

  const overdue = followUps.filter((c) => c.next_follow_up_at! < today).length;
  const dueToday = followUps.filter((c) => c.next_follow_up_at === today).length;

  // Leads activos sin próximo seguimiento: riesgo de que se pierdan.
  const withoutFollowUp = companies.filter(
    (c) => !c.next_follow_up_at && !CLOSED_STATUSES.includes(c.status) && c.status !== "pausado",
  ).length;

  const greeting = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm capitalize text-graphite">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          {overdue + dueToday > 0
            ? `${overdue + dueToday} ${overdue + dueToday === 1 ? "seguimiento" : "seguimientos"} para hoy`
            : "Todo al día"}
        </h1>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar los datos. Revisa la conexión con Supabase.
        </p>
      )}

      {/* Métricas */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Metric label="Total leads" value={companies.length} href="/companies" />
        <Metric label="Nuevos" value={byStatus.nuevo} href="/companies?status=nuevo" />
        <Metric label="Contactados" value={byStatus.contactado} href="/companies?status=contactado" />
        <Metric label="Reuniones" value={byStatus.reunion} href="/companies?status=reunion" />
        <Metric label="Propuestas" value={byStatus.propuesta} href="/companies?status=propuesta" />
        <Metric label="Ganados" value={byStatus.ganado} href="/companies?status=ganado" accent />
        <Metric label="Perdidos" value={count("perdido")} href="/companies?status=perdido" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Seguimientos */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="section-title">Seguimientos · próximos 7 días</h2>
            {overdue > 0 && <span className="text-xs font-medium text-red-600">{overdue} vencidos</span>}
          </div>

          {followUps.length === 0 ? (
            <p className="py-6 text-sm text-graphite">No hay seguimientos para esta semana.</p>
          ) : (
            <ul className="divide-y divide-line">
              {followUps.map((c) => {
                const late = c.next_follow_up_at! < today;
                const isToday = c.next_follow_up_at === today;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/companies/${c.id}`}
                      className="-mx-2 flex items-start gap-4 rounded-lg px-2 py-3 transition hover:bg-canvas"
                    >
                      <span
                        className={`mt-0.5 w-28 shrink-0 text-xs font-semibold ${
                          late ? "text-red-600" : isToday ? "text-violet" : "text-graphite"
                        }`}
                      >
                        {followUpLabel(c.next_follow_up_at!, today)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <StatusBadge status={c.status} />
                        </span>
                        {c.follow_up_note && (
                          <span className="mt-0.5 block truncate text-sm text-graphite">{c.follow_up_note}</span>
                        )}
                      </span>
                      <span className="hidden sm:block">
                        <PriorityBadge priority={c.priority} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {withoutFollowUp > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {withoutFollowUp} {withoutFollowUp === 1 ? "lead activo no tiene" : "leads activos no tienen"} próximo
              seguimiento.{" "}
              <Link href="/companies?sort=follow_up" className="font-medium underline">
                Revisar
              </Link>
            </p>
          )}
        </section>

        {/* Pipeline */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="section-title">Pipeline</h2>
            {openValue > 0 && (
              <span className="text-xs text-graphite" title="Reunión + propuesta + negociación">
                {formatMoney(openValue)} en juego
              </span>
            )}
          </div>
          <ul className="space-y-2.5">
            {PIPELINE_STATUSES.map((s) => (
              <li key={s}>
                <Link href={`/companies?status=${s}`} className="group grid grid-cols-[96px_1fr_28px] items-center gap-3">
                  <span className="text-sm text-graphite group-hover:text-ink">{statusLabel(s)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-canvas">
                    <span
                      className={`block h-full rounded-full ${s === "ganado" ? "bg-emerald-500" : "bg-violet"}`}
                      style={{ width: `${(byStatus[s] / maxStage) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-sm font-medium tabular-nums">{byStatus[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-graphite">
            Pausados: {count("pausado")} · Perdidos: {count("perdido")}
          </p>
        </section>
      </div>
    </div>
  );
}
