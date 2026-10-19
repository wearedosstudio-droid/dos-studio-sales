import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam } from "@/lib/team";
import { ACTIVE_PHASES, PHASES, isPhase } from "@/lib/os";
import { formatMoney, todayISO } from "@/lib/format";
import type { Client } from "@/lib/types";
import { Avatar, Empty, PhaseBadge } from "@/components/OS";
import { DemoBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Clientes" };

type SearchParams = { phase?: string; q?: string };

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, me } = await session();
  const phase = isPhase(searchParams.phase) || searchParams.phase === "todos" ? searchParams.phase : "activos";
  const q = (searchParams.q ?? "").trim().slice(0, 100);

  let query = supabase.from("clients").select("*").order("name");
  if (phase === "activos") query = query.in("phase", ACTIVE_PHASES);
  else if (phase !== "todos") query = query.eq("phase", phase!);
  if (q) query = query.ilike("name", `%${q.replace(/[%,()*\\]/g, " ")}%`);

  const today = todayISO();
  const [{ data }, team, { data: openTasks }, { data: unpaid }, { data: all }] = await Promise.all([
    query,
    getTeam(supabase),
    supabase.from("tasks").select("client_id, due_date").eq("status", "pendiente"),
    supabase.from("invoices").select("client_id, total, due_date").eq("status", "emitida"),
    supabase.from("clients").select("phase"),
  ]);
  const clients = (data ?? []) as Client[];

  const tasksBy = new Map<string, { open: number; late: number }>();
  for (const t of openTasks ?? []) {
    if (!t.client_id) continue;
    const s = tasksBy.get(t.client_id) ?? { open: 0, late: 0 };
    s.open++;
    if (t.due_date < today) s.late++;
    tasksBy.set(t.client_id, s);
  }
  const debtBy = new Map<string, { amount: number; late: boolean }>();
  for (const i of unpaid ?? []) {
    const s = debtBy.get(i.client_id) ?? { amount: 0, late: false };
    s.amount += Number(i.total);
    if (i.due_date < today) s.late = true;
    debtBy.set(i.client_id, s);
  }
  const counts = (p: string) => (all ?? []).filter((c) => c.phase === p).length;
  const activeCount = (all ?? []).filter((c) => (ACTIVE_PHASES as string[]).includes(c.phase)).length;
  const mrr = clients.filter((c) => (ACTIVE_PHASES as string[]).includes(c.phase)).reduce((s, c) => s + Number(c.monthly_fee ?? 0), 0);

  const filters = [
    { value: "activos", label: "Activos", n: activeCount },
    ...PHASES.map((p) => ({ value: p.value, label: p.label, n: counts(p.value) })),
    { value: "todos", label: "Todos", n: (all ?? []).length },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-graphite">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
            {phase === "activos" && mrr > 0 && ` · ${formatMoney(mrr)} al mes en cuotas`}
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          + Nuevo cliente
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Filtrar por fase">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={`/clients?phase=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={phase === f.value ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${phase === f.value ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}
            >
              {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
            </Link>
          ))}
        </nav>
        <form className="ml-auto">
          <input type="hidden" name="phase" value={phase} />
          <input name="q" defaultValue={q} placeholder="Buscar cliente…" aria-label="Buscar cliente" className="input w-56" />
        </form>
      </div>

      {clients.length === 0 ? (
        <section className="card px-6">
          <Empty title={q || phase !== "activos" ? "Ningún cliente con estos filtros." : "Todavía no hay clientes."}>
            {!q && (
              <>
                Crea uno desde aquí o convierte una empresa ganada del{" "}
                <Link href="/companies?status=ganado" className="text-violet hover:underline">
                  comercial
                </Link>
                .
              </>
            )}
          </Empty>
        </section>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-graphite">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Fase</th>
                <th className="px-3 py-3 font-medium">Equipo</th>
                <th className="px-3 py-3 text-right font-medium">Cuota</th>
                <th className="px-3 py-3 font-medium">Tareas</th>
                <th className="px-5 py-3 text-right font-medium">Pendiente de cobro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map((c) => {
                const t = tasksBy.get(c.id);
                const d = debtBy.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:text-violet">
                        {c.name}
                      </Link>
                      {c.is_demo && <span className="ml-2"><DemoBadge /></span>}
                      <p className="text-xs text-graphite">{c.service ?? "Servicio sin definir"}</p>
                    </td>
                    <td className="px-3 py-3"><PhaseBadge phase={c.phase} /></td>
                    <td className="px-3 py-3">
                      <span className="flex gap-1">
                        <Avatar team={team} id={c.owner_id} me={me} />
                        {c.reviewer_id && <Avatar team={team} id={c.reviewer_id} me={me} />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.monthly_fee ? formatMoney(c.monthly_fee) : "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      {t ? (
                        <span>
                          {t.open} abiertas{t.late > 0 && <span className="font-medium text-red-600"> · {t.late} vencidas</span>}
                        </span>
                      ) : (
                        <span className="text-graphite">Al día</span>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums ${d?.late ? "font-medium text-red-600" : ""}`}>
                      {d ? formatMoney(d.amount) : "—"}
                    </td>
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
