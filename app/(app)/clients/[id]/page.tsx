import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { session } from "@/lib/session";
import { getTeam, personName } from "@/lib/team";
import type { ActivityRow, Client, DocumentRow, Invoice, Task } from "@/lib/types";
import { FOLDERS, PHASES, isFolder, paymentLabel } from "@/lib/os";
import {
  addMonths,
  currentPeriod,
  formatDate,
  formatMinutes,
  formatMoney,
  formatMoneyExact,
  todayISO,
} from "@/lib/format";
import { Avatar, Empty, ErrorNote, InvoiceBadge, PhaseBadge } from "@/components/OS";
import { DemoBadge } from "@/components/Badges";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { TaskItem } from "@/components/TaskItem";
import { DocumentUploader } from "@/components/DocumentUploader";
import { DocList } from "@/components/DocList";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { addTime, deleteClientAction, deleteTime, generateMonth, generateOnboarding, setPhase } from "../actions";
import { createTask } from "../../tasks/actions";
import { addLink } from "../../documents/actions";

export const metadata: Metadata = { title: "Cliente" };

const TABS = [
  { value: "tareas", label: "Tareas" },
  { value: "documentos", label: "Documentos" },
  { value: "facturas", label: "Facturas" },
  { value: "horas", label: "Horas" },
  { value: "historial", label: "Historial" },
] as const;

type SP = { tab?: string; error?: string; ok?: string; period?: string; folder?: string };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function ClientPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const { supabase, me } = await session();
  const tab = TABS.some((t) => t.value === searchParams.tab) ? searchParams.tab! : "tareas";

  const [{ data: cData }, team] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    getTeam(supabase),
  ]);
  if (!cData) notFound();
  const c = cData as Client;
  const today = todayISO();

  const [{ data: tData }, { data: iData }, { count: docCount }] = await Promise.all([
    supabase.from("tasks").select("*").eq("client_id", c.id).order("due_date").order("sort"),
    supabase.from("invoices").select("*").eq("client_id", c.id).order("issue_date", { ascending: false }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("client_id", c.id),
  ]);
  const tasks = (tData ?? []) as Task[];
  const invoices = (iData ?? []) as Invoice[];
  const openTasks = tasks.filter((t) => t.status === "pendiente");
  const pendingDebt = invoices.filter((i) => i.status === "emitida").reduce((s, i) => s + Number(i.total), 0);
  const lateDebt = invoices.some((i) => i.status === "emitida" && i.due_date < today);
  const missingTax = [!c.legal_name && "razón social", !c.nif && "NIF", !c.address && "dirección"].filter(Boolean) as string[];
  const contractEnd = c.min_months ? addMonths(c.start_date.slice(0, 7), c.min_months) : null;

  const counts: Record<string, number> = {
    tareas: openTasks.length,
    documentos: docCount ?? 0,
    facturas: invoices.filter((i) => i.status !== "anulada").length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link href="/clients" className="text-xs font-medium text-graphite hover:text-violet">
          ← Clientes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{c.name}</h1>
              <PhaseBadge phase={c.phase} />
              {c.is_demo && <DemoBadge />}
            </div>
            <p className="mt-1 text-sm text-graphite">{c.service ?? "Servicio sin definir"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={setPhase.bind(null, c.id)}>
              <AutoSubmitSelect key={c.phase} name="phase" value={c.phase} options={PHASES} label="Fase" />
            </form>
            <Link href={`/clients/${c.id}/edit`} className="btn-secondary">
              Editar
            </Link>
            <Link href={`/invoices/new?client=${c.id}`} className="btn-primary">
              Nueva factura
            </Link>
          </div>
        </div>

        <dl className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Cuota mensual">{c.monthly_fee ? formatMoney(c.monthly_fee) : "Pago único"}</Fact>
          <Fact label="Inicio">{formatDate(c.start_date)}</Fact>
          <Fact label="Permanencia hasta">{contractEnd ? formatDate(`${contractEnd}-01`).replace(/^1 /, "") : "—"}</Fact>
          <Fact label="Responsable">
            <span className="flex items-center gap-1.5">
              <Avatar team={team} id={c.owner_id} me={me} />
              {personName(team, c.owner_id, me)}
            </span>
          </Fact>
          <Fact label="Revisor">
            <span className="flex items-center gap-1.5">
              <Avatar team={team} id={c.reviewer_id} me={me} />
              {personName(team, c.reviewer_id, me)}
            </span>
          </Fact>
          <Fact label="Pendiente de cobro">
            <span className={lateDebt ? "text-red-600" : ""}>{pendingDebt ? formatMoneyExact(pendingDebt) : "—"}</span>
          </Fact>
        </dl>

        {searchParams.error === "facturas" && (
          <ErrorNote>Este cliente tiene facturas y no se puede borrar. Pásalo a la fase «Cerrado».</ErrorNote>
        )}
        {searchParams.error === "borrar" && <ErrorNote>No se pudo borrar el cliente.</ErrorNote>}
        {searchParams.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{searchParams.ok}.</p>}
        {missingTax.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Para facturar falta: {missingTax.join(", ")}.{" "}
            <Link href={`/clients/${c.id}/edit`} className="font-medium underline">
              Completar
            </Link>
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card min-w-0">
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-3" aria-label="Secciones del cliente">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={`/clients/${c.id}?tab=${t.value}`}
                aria-current={tab === t.value ? "page" : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                  tab === t.value ? "border-violet text-ink" : "border-transparent text-graphite hover:text-ink"
                }`}
              >
                {t.label}
                {counts[t.value] ? <span className="ml-1.5 tabular-nums text-graphite">{counts[t.value]}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="p-5">
            {tab === "tareas" && <TasksTab client={c} tasks={tasks} team={team} me={me} sp={searchParams} />}
            {tab === "documentos" && <DocumentsTab client={c} team={team} me={me} folder={searchParams.folder} />}
            {tab === "facturas" && <InvoicesTab client={c} invoices={invoices} today={today} />}
            {tab === "horas" && <HoursTab client={c} team={team} me={me} />}
            {tab === "historial" && <HistoryTab client={c} team={team} me={me} />}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="section-title mb-3">Contacto</h2>
            <p className="text-sm font-medium">{c.contact_name ?? "—"}</p>
            {c.contact_email && <p className="break-all text-sm text-graphite">{c.contact_email}</p>}
            {c.contact_phone && <p className="text-sm text-graphite">{c.contact_phone}</p>}
          </section>
          <section className="card p-5">
            <h2 className="section-title mb-3">Facturación</h2>
            <p className="text-sm font-medium">{c.legal_name ?? c.name}</p>
            <p className="text-sm text-graphite">{c.nif ?? "Sin NIF"}</p>
            <p className="whitespace-pre-line text-sm text-graphite">
              {[c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || "Sin dirección"}
            </p>
            <p className="mt-2 text-xs text-graphite">
              {paymentLabel(c.payment_method)}
              {c.payment_days !== null && ` · ${c.payment_days} días`}
            </p>
          </section>
          {c.notes && (
            <section className="card p-5">
              <h2 className="section-title mb-3">Notas</h2>
              <p className="whitespace-pre-line text-sm">{c.notes}</p>
            </section>
          )}
          <section className="space-y-2 px-1 text-xs text-graphite">
            {c.company_id && (
              <p>
                Viene del{" "}
                <Link href={`/companies/${c.company_id}`} className="text-violet hover:underline">
                  comercial
                </Link>
                .
              </p>
            )}
            <p>Creado el {formatDate(c.created_at)}</p>
            <form action={deleteClientAction.bind(null, c.id)}>
              <ConfirmButton
                message={`¿Eliminar "${c.name}" con sus tareas, documentos y horas? No se puede deshacer.`}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Eliminar cliente
              </ConfirmButton>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TasksTab({ client: c, tasks, team, me, sp }: { client: Client; tasks: Task[]; team: Awaited<ReturnType<typeof getTeam>>; me: string; sp: SP }) {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const g = t.group_label ?? "Tareas sueltas";
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  // Grupos con tareas pendientes primero, por fecha.
  const ordered = Array.from(groups.entries()).sort(([, a], [, b]) => {
    const pa = a.some((t) => t.status === "pendiente") ? 0 : 1;
    const pb = b.some((t) => t.status === "pendiente") ? 0 : 1;
    return pa - pb || (a[0].due_date < b[0].due_date ? -1 : 1);
  });
  const hasOnboarding = tasks.some((t) => t.kind === "onboarding");
  const period = currentPeriod();

  return (
    <div className="space-y-6">
      <form action={createTask} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="client_id" value={c.id} />
        <div className="min-w-[200px] flex-1">
          <label htmlFor="title" className="label">Nueva tarea</label>
          <input id="title" name="title" required maxLength={300} placeholder="Ej.: Pedir fotos de producto" className="input" />
        </div>
        <div>
          <label htmlFor="due_date" className="label">Vence</label>
          <input id="due_date" name="due_date" type="date" defaultValue={todayISO()} className="input" />
        </div>
        <div>
          <label htmlFor="assignee_id" className="label">Responsable</label>
          <select id="assignee_id" name="assignee_id" defaultValue={c.owner_id ?? ""} className="input">
            <option value="">Sin asignar</option>
            {Object.values(team).map((p) => (
              <option key={p.id} value={p.id}>{personName(team, p.id, me)}</option>
            ))}
          </select>
        </div>
        <SubmitButton className="btn-secondary" pendingText="Añadiendo…">Añadir</SubmitButton>
      </form>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-canvas p-3">
        {!hasOnboarding && (
          <form action={generateOnboarding.bind(null, c.id)}>
            <SubmitButton className="btn-secondary py-1.5" pendingText="Creando…">Generar onboarding</SubmitButton>
          </form>
        )}
        <form action={generateMonth.bind(null, c.id)} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="period" className="label">Ciclo mensual de</label>
            <input id="period" name="period" type="month" defaultValue={sp.period ?? period} className="input w-auto py-1.5" />
          </div>
          <SubmitButton className="btn-secondary py-1.5" pendingText="Creando…">Generar ciclo</SubmitButton>
        </form>
        <p className="text-xs text-graphite">Factura, informe, temas, producción y programación con sus fechas.</p>
      </div>
      {sp.error === "mes" && <ErrorNote>Ese mes ya tiene su ciclo generado.</ErrorNote>}

      {ordered.length === 0 ? (
        <Empty title="Este cliente no tiene tareas.">Genera el onboarding o el ciclo del mes, o añade una tarea suelta.</Empty>
      ) : (
        ordered.map(([group, list]) => (
          <div key={group}>
            <h3 className="section-title flex items-center justify-between">
              {group}
              <span className="tabular-nums">
                {list.filter((t) => t.status === "hecha").length}/{list.length}
              </span>
            </h3>
            <ul className="divide-y divide-line">
              {list.map((t) => (
                <TaskItem key={t.id} task={t} team={team} me={me} showClient={false} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

async function DocumentsTab({ client: c, team, me, folder }: { client: Client; team: Awaited<ReturnType<typeof getTeam>>; me: string; folder?: string }) {
  const { supabase } = await session();
  let q = supabase.from("documents").select("*").eq("client_id", c.id).order("created_at", { ascending: false });
  const f = isFolder(folder) ? folder : null;
  if (f) q = q.eq("folder", f);
  const { data } = await q;
  const docs = (data ?? []) as DocumentRow[];

  return (
    <div className="space-y-5">
      <DocumentUploader clientId={c.id} defaultFolder={f ?? "contrato"} />
      <form action={addLink.bind(null, c.id)} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor="link-name" className="label">Guardar enlace (Drive, Figma, Canva…)</label>
          <input id="link-name" name="name" placeholder="Contrato firmado" className="input" />
        </div>
        <div className="min-w-[200px] flex-[2]">
          <label htmlFor="link-url" className="label">URL</label>
          <input id="link-url" name="url" type="url" required placeholder="https://" className="input" />
        </div>
        <select name="folder" defaultValue={f ?? "contrato"} aria-label="Carpeta" className="input w-auto">
          {FOLDERS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <SubmitButton className="btn-secondary" pendingText="Guardando…">Guardar enlace</SubmitButton>
      </form>

      <nav className="flex flex-wrap gap-1" aria-label="Carpetas">
        <Link href={`/clients/${c.id}?tab=documentos`} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${!f ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>Todas</Link>
        {FOLDERS.map((x) => (
          <Link key={x.value} href={`/clients/${c.id}?tab=documentos&folder=${x.value}`} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${f === x.value ? "bg-violet-soft text-violet" : "text-graphite hover:text-ink"}`}>
            {x.label}
          </Link>
        ))}
      </nav>

      {docs.length === 0 ? (
        <Empty title={f ? "No hay documentos en esta carpeta." : "Todavía no hay documentos."} />
      ) : (
        <DocList docs={docs} team={team} me={me} />
      )}
    </div>
  );
}

function InvoicesTab({ client: c, invoices, today }: { client: Client; invoices: Invoice[]; today: string }) {
  if (!invoices.length) {
    return (
      <Empty title="Sin facturas.">
        <Link href={`/invoices/new?client=${c.id}`} className="text-violet hover:underline">Crear la primera</Link>
      </Empty>
    );
  }
  const billed = invoices.filter((i) => i.status === "emitida" || i.status === "cobrada").reduce((s, i) => s + Number(i.total), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-graphite">Facturado en total: <span className="font-medium text-ink">{formatMoneyExact(billed)}</span></p>
      <ul className="divide-y divide-line">
        {invoices.map((i) => (
          <li key={i.id}>
            <Link href={`/invoices/${i.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-canvas">
              <span className="w-28 shrink-0 text-sm font-medium tabular-nums">{i.number ?? "Borrador"}</span>
              <span className="min-w-0 flex-1 text-xs text-graphite">
                {formatDate(i.issue_date)} · vence {formatDate(i.due_date)}
              </span>
              <InvoiceBadge status={i.status} overdue={i.due_date < today} />
              <span className="w-24 text-right text-sm tabular-nums">{formatMoneyExact(i.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function HoursTab({ client: c, team, me }: { client: Client; team: Awaited<ReturnType<typeof getTeam>>; me: string }) {
  const { supabase } = await session();
  const { data } = await supabase.from("time_entries").select("*").eq("client_id", c.id).order("work_date", { ascending: false }).limit(100);
  const entries = (data ?? []) as { id: string; user_id: string | null; work_date: string; minutes: number; note: string | null }[];
  const period = currentPeriod();
  const monthMin = entries.filter((e) => e.work_date.startsWith(period)).reduce((s, e) => s + e.minutes, 0);
  const perHour = c.monthly_fee && monthMin ? Number(c.monthly_fee) / (monthMin / 60) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-canvas p-4">
          <p className="text-xs text-graphite">Horas este mes</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatMinutes(monthMin)}</p>
        </div>
        <div className="rounded-xl bg-canvas p-4">
          <p className="text-xs text-graphite">Cuota</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{c.monthly_fee ? formatMoney(c.monthly_fee) : "—"}</p>
        </div>
        <div className="rounded-xl bg-canvas p-4">
          <p className="text-xs text-graphite">Ingreso por hora</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{perHour ? `${formatMoney(perHour)}/h` : "—"}</p>
        </div>
      </div>
      <form action={addTime.bind(null, c.id)} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="hours" className="label">Horas</label>
          <input id="hours" name="hours" type="number" min="0.25" max="24" step="0.25" required placeholder="1,5" className="input w-24" />
        </div>
        <div>
          <label htmlFor="work_date" className="label">Día</label>
          <input id="work_date" name="work_date" type="date" defaultValue={todayISO()} className="input" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label htmlFor="note" className="label">Qué se hizo</label>
          <input id="note" name="note" maxLength={300} placeholder="Diseño de 6 piezas" className="input" />
        </div>
        <SubmitButton className="btn-secondary" pendingText="Guardando…">Registrar</SubmitButton>
      </form>
      {entries.length === 0 ? (
        <Empty title="Sin horas registradas.">Apuntar las horas permite saber qué clientes son rentables.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="group flex items-center gap-3 py-2.5 text-sm">
              <Avatar team={team} id={e.user_id} me={me} />
              <span className="w-24 shrink-0 text-xs text-graphite">{formatDate(e.work_date)}</span>
              <span className="min-w-0 flex-1 truncate">{e.note ?? "—"}</span>
              <span className="tabular-nums">{formatMinutes(e.minutes)}</span>
              <form action={deleteTime.bind(null, c.id, e.id)}>
                <button type="submit" className="text-xs text-graphite hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100">Borrar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function HistoryTab({ client: c, team, me }: { client: Client; team: Awaited<ReturnType<typeof getTeam>>; me: string }) {
  const { supabase } = await session();
  const { data } = await supabase.from("activity_log").select("*").eq("client_id", c.id).order("at", { ascending: false }).limit(150);
  return <ActivityFeed rows={(data ?? []) as ActivityRow[]} team={team} me={me} />;
}
