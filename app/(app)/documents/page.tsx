import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { DocumentRow } from "@/lib/types";
import { FOLDERS, isFolder } from "@/lib/os";
import { DocList } from "@/components/DocList";
import { Empty } from "@/components/OS";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage({ searchParams }: { searchParams: { folder?: string; client?: string } }) {
  const { supabase, me } = await session();
  const folder = isFolder(searchParams.folder) ? searchParams.folder : null;
  const client = searchParams.client && /^[0-9a-f-]{36}$/i.test(searchParams.client) ? searchParams.client : null;

  let q = supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(300);
  if (folder) q = q.eq("folder", folder);
  if (client) q = q.eq("client_id", client);
  const [{ data }, team, { data: cs }] = await Promise.all([q, getTeam(supabase), supabase.from("clients").select("id, name").order("name")]);
  const docs = (data ?? []) as DocumentRow[];
  const clients = Object.fromEntries((cs ?? []).map((c) => [c.id, c.name as string]));
  const link = (f: string | null, c: string | null) => `/documents?${new URLSearchParams({ ...(f ? { folder: f } : {}), ...(c ? { client: c } : {}) })}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Documentos</h1>
        <p className="mt-1 text-sm text-graphite">Todo lo subido o enlazado, por cliente y carpeta. Para añadir, entra en la ficha del cliente.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-paper p-1 ring-1 ring-line" aria-label="Carpetas">
          <Link href={link(null, client)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!folder ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>Todas</Link>
          {FOLDERS.map((f) => (
            <Link key={f.value} href={link(f.value, client)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${folder === f.value ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex gap-2">
          {folder && <input type="hidden" name="folder" value={folder} />}
          <select name="client" defaultValue={client ?? ""} aria-label="Cliente" className="input w-auto">
            <option value="">Todos los clientes</option>
            {(cs ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="btn-secondary">Filtrar</button>
        </form>
      </div>
      <section className="card px-5">
        {docs.length ? <DocList docs={docs} team={team} me={me} clients={clients} /> : <Empty title="No hay documentos con estos filtros." />}
      </section>
    </div>
  );
}
