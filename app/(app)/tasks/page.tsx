import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam, personName } from "@/lib/team";
import type { Task } from "@/lib/types";
import { addDaysISO, currentPeriod, todayISO } from "@/lib/format";
import { TaskItem } from "@/components/TaskItem";
import { Empty } from "@/components/OS";
import { SubmitButton } from "@/components/SubmitButton";
import { createTask } from "./actions";
import { generateMonthForAll } from "../clients/actions";

export const metadata: Metadata = { title: "Tareas" };

type SP = { who?: string; show?: string; ok?: string };

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const { supabase, me } = await session();
  const who = searchParams.who === "todas" ? "todas" : "mias";
  const show = searchParams.show === "hechas" ? "hechas" : "pendientes";

  let q = supabase.from("tasks").select("*");
  if (who === "mias") q = q.eq("assignee_id", me);
  q = show === "hechas" ? q.eq("status", "hecha").order("completed_at", { ascending: false }).limit(100) : q.eq("status", "pendiente").order("due_date").order("sort");

  const [{ data }, team, { data: clientRows }] = await Promise.all([q, getTeam(supabase), supabase.from("clients").select("id, name, phase")]);
  const clients = Object.fromEntries((clientRows ?? []).map((c) => [c.id, c.name as string]));
  const closed = new Set((clientRows ?? []).filter((c) => c.phase === "cerrado").map((c) => c.id));
  const tasks = ((data ?? []) as Task[]).filter((t) => !t.client_id || !closed.has(t.client_id));

  const today = todayISO();
  const week = addDaysISO(today, 7);
  const groups: [string, string, Task[]][] =
    show === "hechas"
      ? [["Completadas recientemente", "", tasks]]
      : [
          ["Vencidas", "text-red-600", tasks.filter((t) => t.due_date < today)],
          ["Hoy", "text-violet", tasks.filter((t) => t.due_date === today)],
          ["Próximos 7 días", "", tasks.filter((t) => t.due_date > today && t.due_date <= week)],
          ["Más adelante", "", tasks.filter((t) => t.due_date > week)],
        ];

  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <p className="mt-1 text-sm text-graphite">
            {tasks.length} {show === "hechas" ? "completadas" : "pendientes"}
            {who === "mias" ? " a tu nombre" : " del equipo"}
          </p>
        </div>
        <form action={generateMonthForAll} className="flex items-end gap-2">
          <div>
            <label htmlFor="period" className="label">Ciclo mensual para todos</label>
            <input id="period" name="period" type="month" defaultValue={currentPeriod()} className="input w-auto py-1.5" />
          </div>
          <SubmitButton className="btn-secondary py-1.5" pendingText="Creando…">Generar</SubmitButton>
        </form>
      </header>
      {searchParams.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{searchParams.ok}.</p>}

      <div className="flex flex-wrap gap-3">
        <nav className="flex gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="De quién">
          {tab("Mías", `/tasks?who=mias&show=${show}`, who === "mias")}
          {tab("Todo el equipo", `/tasks?who=todas&show=${show}`, who === "todas")}
        </nav>
        <nav className="flex gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Estado">
          {tab("Pendientes", `/tasks?who=${who}&show=pendientes`, show === "pendientes")}
          {tab("Hechas", `/tasks?who=${who}&show=hechas`, show === "hechas")}
        </nav>
      </div>

      <form action={createTask} className="card flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="title" className="label">Nueva tarea</label>
          <input id="title" name="title" required maxLength={300} placeholder="Ej.: Preparar propuesta para…" className="input" />
        </div>
        <div>
          <label htmlFor="client_id" className="label">Cliente</label>
          <select id="client_id" name="client_id" className="input">
            <option value="">Interna (sin cliente)</option>
            {(clientRows ?? []).filter((c) => c.phase !== "cerrado").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="due_date" className="label">Vence</label>
          <input id="due_date" name="due_date" type="date" defaultValue={today} className="input" />
        </div>
        <div>
          <label htmlFor="assignee_id" className="label">Para</label>
          <select id="assignee_id" name="assignee_id" defaultValue={me} className="input">
            <option value="">Sin asignar</option>
            {Object.values(team).map((p) => <option key={p.id} value={p.id}>{personName(team, p.id, me)}</option>)}
          </select>
        </div>
        <SubmitButton className="btn-primary" pendingText="Añadiendo…">Añadir</SubmitButton>
      </form>

      {tasks.length === 0 ? (
        <section className="card px-6">
          <Empty title={show === "hechas" ? "Aún no hay tareas completadas." : "Nada pendiente."}>
            {show === "pendientes" && "Genera el ciclo mensual o crea una tarea arriba."}
          </Empty>
        </section>
      ) : (
        groups
          .filter(([, , list]) => list.length)
          .map(([title, color, list]) => (
            <section key={title} className="card px-5 py-4">
              <h2 className={`section-title mb-1 ${color}`}>
                {title} · {list.length}
              </h2>
              <ul className="divide-y divide-line">
                {list.map((t) => (
                  <TaskItem key={t.id} task={t} team={team} me={me} clientName={t.client_id ? clients[t.client_id] : null} />
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
