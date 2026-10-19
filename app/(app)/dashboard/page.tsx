import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { ActivityRow, Invoice, Notification, Task } from "@/lib/types";
import { CLOSED_STATUSES, type Status } from "@/lib/constants";
import { ACTIVE_PHASES } from "@/lib/os";
import { addDaysISO, daysBetween, followUpLabel, formatMoney, formatMoneyExact, timeAgo, todayISO } from "@/lib/format";
import { StatusBadge } from "@/components/Badges";
import { TaskItem } from "@/components/TaskItem";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Empty } from "@/components/OS";

export const metadata: Metadata = { title: "Inicio" };

function Metric({ label, value, href, tone }: { label: string; value: string | number; href: string; tone?: "red" | "violet" }) {
  return (
    <Link href={href} className={`card block p-4 transition hover:border-violet/40 ${tone === "violet" ? "border-violet/30 bg-violet-soft/40" : ""}`}>
      <p className="text-xs font-medium text-graphite">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : tone === "violet" ? "text-violet" : ""}`}>{value}</p>
    </Link>
  );
}

type FollowUp = { id: string; name: string; status: Status; next_follow_up_at: string; follow_up_note: string | null };

export default async function DashboardPage() {
  const { supabase, me } = await session();
  const today = todayISO();
  const soon = addDaysISO(today, 3);

  const [{ data: tData }, { data: clients }, { data: iData }, { data: fData }, { data: nData }, { data: aData }, team] = await Promise.all([
    supabase.from("tasks").select("*").eq("status", "pendiente").lte("due_date", soon).order("due_date").order("sort"),
    supabase.from("clients").select("id, name, phase, monthly_fee"),
    supabase.from("invoices").select("*").in("status", ["emitida", "borrador"]),
    supabase
      .from("companies")
      .select("id, name, status, next_follow_up_at, follow_up_note")
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", addDaysISO(today, 7))
      .order("next_follow_up_at"),
    supabase.from("notifications").select("*").eq("user_id", me).is("read_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("activity_log").select("*").order("at", { ascending: false }).limit(8),
    getTeam(supabase),
  ]);

  const names = Object.fromEntries((clients ?? []).map((c) => [c.id, c.name as string]));
  const closed = new Set((clients ?? []).filter((c) => c.phase === "cerrado").map((c) => c.id));
  const allTasks = ((tData ?? []) as Task[]).filter((t) => !t.client_id || !closed.has(t.client_id));
  const mine = allTasks.filter((t) => t.assignee_id === me || !t.assignee_id);
  const myLate = mine.filter((t) => t.due_date < today);
  const myToday = mine.filter((t) => t.due_date === today);
  const mrr = (clients ?? []).filter((c) => (ACTIVE_PHASES as string[]).includes(c.phase)).reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);

  const invoices = (iData ?? []) as Invoice[];
  const pending = invoices.filter((i) => i.status === "emitida");
  const overdueInv = pending.filter((i) => i.due_date < today).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const drafts = invoices.filter((i) => i.status === "borrador").length;
  const debt = pending.reduce((s, i) => s + Number(i.total), 0);

  const followUps = ((fData ?? []) as FollowUp[]).filter((c) => !CLOSED_STATUSES.includes(c.status) && c.status !== "pausado");
  const notifications = (nData ?? []) as Notification[];

  const greeting = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date());
  const urgent = myLate.length + myToday.length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm capitalize text-graphite">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          {urgent > 0 ? `${urgent} ${urgent === 1 ? "tarea" : "tareas"} para hoy` : "Todo al día"}
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Mis tareas vencidas" value={myLate.length} href="/tasks" tone={myLate.length ? "red" : undefined} />
        <Metric label="Seguimientos comerciales" value={followUps.filter((f) => f.next_follow_up_at <= today).length} href="/companies?sort=follow_up" />
        <Metric label="Pendiente de cobro" value={formatMoney(debt)} href="/invoices?status=pendientes" tone={overdueInv.length ? "red" : undefined} />
        <Metric label="Ingresos recurrentes" value={formatMoney(mrr)} href="/reports" tone="violet" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="section-title">Mis tareas · hasta dentro de 3 días</h2>
              <Link href="/tasks" className="text-xs font-medium text-violet hover:underline">Ver todas</Link>
            </div>
            {mine.length === 0 ? (
              <Empty title="Nada pendiente para estos días." />
            ) : (
              <ul className="divide-y divide-line">
                {mine.slice(0, 12).map((t) => (
                  <TaskItem key={t.id} task={t} team={team} me={me} clientName={t.client_id ? names[t.client_id] : null} />
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Seguimientos comerciales · 7 días</h2>
              <Link href="/companies" className="text-xs font-medium text-violet hover:underline">Comercial</Link>
            </div>
            {followUps.length === 0 ? (
              <Empty title="No hay seguimientos esta semana." />
            ) : (
              <ul className="divide-y divide-line">
                {followUps.slice(0, 8).map((c) => {
                  const late = c.next_follow_up_at < today;
                  return (
                    <li key={c.id}>
                      <Link href={`/companies/${c.id}`} className="-mx-2 flex items-start gap-4 rounded-lg px-2 py-3 hover:bg-canvas">
                        <span className={`mt-0.5 w-28 shrink-0 text-xs font-semibold ${late ? "text-red-600" : c.next_follow_up_at === today ? "text-violet" : "text-graphite"}`}>
                          {followUpLabel(c.next_follow_up_at, today)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.name}</span><StatusBadge status={c.status} /></span>
                          {c.follow_up_note && <span className="mt-0.5 block truncate text-sm text-graphite">{c.follow_up_note}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={`card p-5 ${overdueInv.length ? "border-red-200" : ""}`}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Cobros vencidos</h2>
              {drafts > 0 && <Link href="/invoices?status=borrador" className="text-xs font-medium text-violet hover:underline">{drafts} borradores</Link>}
            </div>
            {overdueInv.length === 0 ? (
              <p className="text-sm text-graphite">Nada vencido.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {overdueInv.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <Link href={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-violet">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.client_name ?? names[i.client_id]}</span>
                        <span className="text-xs text-red-600">{i.number} · hace {daysBetween(i.due_date, today)} días</span>
                      </span>
                      <span className="tabular-nums">{formatMoneyExact(i.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Avisos sin leer</h2>
              <Link href="/notifications" className="text-xs font-medium text-violet hover:underline">Ver todos</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-graphite">No tienes avisos nuevos.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {n.link ? <Link href={n.link} className="font-medium hover:text-violet">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
                    <p className="text-xs text-graphite">{timeAgo(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="section-title">Actividad reciente</h2>
              <Link href="/activity" className="text-xs font-medium text-violet hover:underline">Ver todo</Link>
            </div>
            <ActivityFeed rows={(aData ?? []) as ActivityRow[]} team={team} me={me} clients={names} />
          </section>
        </aside>
      </div>
    </div>
  );
}
