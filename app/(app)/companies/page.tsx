import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { CLOSED_STATUSES, PRIORITIES, STATUSES, isPriority, isStatus } from "@/lib/constants";
import { followUpLabel, formatMoney, todayISO } from "@/lib/format";
import { DemoBadge, PriorityBadge, StatusBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Empresas" };

const SORTS = {
  follow_up: { label: "Próximo seguimiento", column: "next_follow_up_at", ascending: true },
  recent: { label: "Más recientes", column: "created_at", ascending: false },
  name: { label: "Nombre", column: "name", ascending: true },
  value: { label: "Valor potencial", column: "potential_value", ascending: false },
} as const;

type SortKey = keyof typeof SORTS;

type SearchParams = { q?: string; status?: string; priority?: string; sort?: string };

function FollowUp({ company, today }: { company: Company; today: string }) {
  if (!company.next_follow_up_at || CLOSED_STATUSES.includes(company.status)) {
    return <span className="text-graphite">—</span>;
  }
  const overdue = company.next_follow_up_at < today;
  const isToday = company.next_follow_up_at === today;
  return (
    <span className={overdue ? "font-medium text-red-600" : isToday ? "font-medium text-violet" : ""}>
      {followUpLabel(company.next_follow_up_at, today)}
    </span>
  );
}

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const status = isStatus(searchParams.status) ? searchParams.status : "";
  const priority = isPriority(searchParams.priority) ? searchParams.priority : "";
  const sortKey: SortKey = searchParams.sort && searchParams.sort in SORTS ? (searchParams.sort as SortKey) : "follow_up";
  const sort = SORTS[sortKey];

  const supabase = createClient();
  let query = supabase
    .from("companies")
    .select("*")
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (q) {
    // Quitamos caracteres que rompen la sintaxis del filtro or() de PostgREST.
    const term = q.replace(/[%,()*\\]/g, " ");
    query = query.or(
      `name.ilike.%${term}%,sector.ilike.%${term}%,city.ilike.%${term}%,contact_name.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  const companies = (data ?? []) as Company[];
  const today = todayISO();
  const filtered = Boolean(q || status || priority);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="mt-1 text-sm text-graphite">
            {companies.length} {companies.length === 1 ? "empresa" : "empresas"}
            {filtered && " con estos filtros"}
          </p>
        </div>
        <Link href="/companies/new" className="btn-primary">
          + Nueva empresa
        </Link>
      </header>

      {/* Filtros: formulario GET, sin JavaScript */}
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_150px_190px_auto]">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar empresa, sector, ciudad, contacto…"
          aria-label="Buscar"
          className="input sm:col-span-2 lg:col-span-1"
        />
        <select name="status" defaultValue={status} aria-label="Estado" className="input">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={priority} aria-label="Prioridad" className="input">
          <option value="">Toda prioridad</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sortKey} aria-label="Ordenar" className="input">
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            Filtrar
          </button>
          {filtered && (
            <Link href="/companies" className="btn-secondary">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar las empresas. Revisa la conexión con Supabase.
        </p>
      )}

      {companies.length === 0 && !error ? (
        <div className="card px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold">
            {filtered ? "Nada con estos filtros" : "Todavía no hay empresas"}
          </p>
          <p className="mt-1 text-sm text-graphite">
            {filtered ? "Prueba con otra búsqueda." : "Añade la primera empresa con un problema detectado."}
          </p>
        </div>
      ) : (
        <>
          {/* Tabla: tablet y escritorio */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs text-graphite">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Prioridad</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Servicio</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Valor</th>
                  <th className="px-4 py-3 font-medium">Seguimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {companies.map((c) => (
                  <tr key={c.id} className="group relative transition hover:bg-violet-soft/40">
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-violet">
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-graphite">
                        {[c.sector, c.city].filter(Boolean).join(" · ")}
                        {c.is_demo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="hidden px-4 py-3 text-graphite lg:table-cell">{c.recommended_service ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{formatMoney(c.potential_value)}</td>
                    <td className="px-4 py-3 text-sm">
                      <FollowUp company={c} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas: móvil */}
          <ul className="space-y-2 md:hidden">
            {companies.map((c) => (
              <li key={c.id}>
                <Link href={`/companies/${c.id}`} className="card block p-4 transition hover:border-violet/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-graphite">{[c.sector, c.city].filter(Boolean).join(" · ")}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <PriorityBadge priority={c.priority} />
                    <FollowUp company={c} today={today} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
