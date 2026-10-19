import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { ActivityRow } from "@/lib/types";
import { ActivityFeed } from "@/components/ActivityFeed";

export const metadata: Metadata = { title: "Actividad" };

const ENTITIES = [
  { value: "", label: "Todo" },
  { value: "clients", label: "Clientes" },
  { value: "tasks", label: "Tareas" },
  { value: "documents", label: "Documentos" },
  { value: "invoices", label: "Facturas" },
  { value: "companies", label: "Comercial" },
];

export default async function ActivityPage({ searchParams }: { searchParams: { e?: string; who?: string } }) {
  const { supabase, me } = await session();
  const e = ENTITIES.some((x) => x.value === searchParams.e) ? searchParams.e! : "";
  const who = searchParams.who && /^[0-9a-f-]{36}$/i.test(searchParams.who) ? searchParams.who : "";

  let q = supabase.from("activity_log").select("*").order("at", { ascending: false }).limit(300);
  if (e) q = q.eq("entity", e);
  if (who) q = q.eq("actor_id", who);
  const [{ data }, team, { data: cs }] = await Promise.all([q, getTeam(supabase), supabase.from("clients").select("id, name")]);
  const clients = Object.fromEntries((cs ?? []).map((c) => [c.id, c.name as string]));
  const href = (x: string, w: string) => `/activity?${new URLSearchParams({ ...(x ? { e: x } : {}), ...(w ? { who: w } : {}) })}`;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Actividad</h1>
        <p className="mt-1 text-sm text-graphite">Registro automático de cada cambio: quién, qué y cuándo. No se puede editar.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Tipo">
          {ENTITIES.map((x) => (
            <Link key={x.value} href={href(x.value, who)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${e === x.value ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
              {x.label}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-wrap gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Persona">
          <Link href={href(e, "")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!who ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>Los dos</Link>
          {Object.values(team).map((p) => (
            <Link key={p.id} href={href(e, p.id)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${who === p.id ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
              {p.id === me ? "Yo" : p.full_name ?? p.email}
            </Link>
          ))}
        </nav>
      </div>
      <section className="card px-5">
        <ActivityFeed rows={(data ?? []) as ActivityRow[]} team={team} me={me} clients={clients} />
      </section>
    </div>
  );
}
