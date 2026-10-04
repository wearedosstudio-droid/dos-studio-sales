import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, Note } from "@/lib/types";
import { CLOSED_STATUSES, PIPELINE_STATUSES, statusLabel } from "@/lib/constants";
import { followUpLabel, formatDate, formatDateTime, formatMoney, todayISO, toUrl } from "@/lib/format";
import { DemoBadge, PriorityBadge } from "@/components/Badges";
import { StatusSelect } from "@/components/StatusSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addNote, completeFollowUp, deleteCompany, deleteNote, saveFollowUp, setStatus } from "../actions";

export const metadata: Metadata = { title: "Empresa" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm">
      <dt className="text-graphite">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? "—"}</dd>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet hover:underline">
      {children}
    </a>
  );
}

export default async function CompanyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: companyData }, { data: notesData }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("notes")
      .select("id, company_id, body, author_email, created_at")
      .eq("company_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!companyData) notFound();
  const c = companyData as Company;
  const notes = (notesData ?? []) as Note[];
  const today = todayISO();
  const overdue = !!c.next_follow_up_at && c.next_follow_up_at < today && !CLOSED_STATUSES.includes(c.status);
  const stageIndex = PIPELINE_STATUSES.indexOf(c.status);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <header className="space-y-4">
        <Link href="/companies" className="text-xs font-medium text-graphite hover:text-violet">
          ← Empresas
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{c.name}</h1>
              {c.is_demo && <DemoBadge />}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite">
              {[c.sector, c.city].filter(Boolean).join(" · ") || "Sin sector"}
              <PriorityBadge priority={c.priority} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action={setStatus.bind(null, c.id)}>
              <StatusSelect key={c.status} value={c.status} />
            </form>
            <Link href={`/companies/${c.id}/edit`} className="btn-secondary">
              Editar
            </Link>
          </div>
        </div>

        {/* Pipeline */}
        <ol className="flex gap-1" aria-label="Pipeline">
          {PIPELINE_STATUSES.map((s, i) => (
            <li key={s} className="flex-1" title={statusLabel(s)}>
              <div
                className={`h-1.5 rounded-full ${
                  stageIndex >= 0 && i <= stageIndex ? (c.status === "ganado" ? "bg-emerald-500" : "bg-violet") : "bg-line"
                }`}
              />
              <span
                className={`mt-1.5 hidden text-[11px] md:block ${
                  s === c.status ? "font-semibold text-ink" : "text-graphite"
                }`}
              >
                {statusLabel(s)}
              </span>
            </li>
          ))}
        </ol>
        {(c.status === "perdido" || c.status === "pausado") && (
          <p className="text-sm text-graphite">
            Este lead está <strong className="text-ink">{statusLabel(c.status).toLowerCase()}</strong>.
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Oportunidad */}
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-4">Oportunidad</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="label">Problema detectado</p>
                <p className="whitespace-pre-line text-sm">{c.problem || "—"}</p>
              </div>
              <div>
                <p className="label">Oportunidad</p>
                <p className="whitespace-pre-line text-sm">{c.opportunity || "—"}</p>
              </div>
              <div>
                <p className="label">Servicio recomendado</p>
                <p className="text-sm font-medium">{c.recommended_service || "Sin definir"}</p>
              </div>
              <div>
                <p className="label">Valor potencial</p>
                <p className="text-sm font-medium">{formatMoney(c.potential_value)}</p>
              </div>
            </div>
            {!c.problem && (
              <p className="mt-4 rounded-lg bg-violet-soft px-3 py-2 text-xs text-violet-deep">
                Falta el problema detectado: es la razón para contactar a esta empresa.
              </p>
            )}
          </section>

          {/* Notas */}
          <section className="card p-5 sm:p-6">
            <h2 className="section-title mb-4">Notas</h2>
            <form key={notes.length} action={addNote.bind(null, c.id)} className="space-y-2">
              <label htmlFor="body" className="sr-only">
                Nueva nota
              </label>
              <textarea
                id="body"
                name="body"
                rows={3}
                required
                maxLength={5000}
                placeholder="Qué ha pasado, qué nos han dicho…"
                className="input resize-y"
              />
              <div className="flex justify-end">
                <SubmitButton pendingText="Añadiendo…">Añadir nota</SubmitButton>
              </div>
            </form>

            {notes.length === 0 ? (
              <p className="mt-4 text-sm text-graphite">Todavía no hay notas.</p>
            ) : (
              <ul className="mt-5 divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className="group py-3">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-graphite">
                      <span>
                        {formatDateTime(n.created_at)}
                        {n.author_email && ` · ${n.author_email}`}
                      </span>
                      <form action={deleteNote.bind(null, c.id, n.id)}>
                        <ConfirmButton
                          message="¿Borrar esta nota?"
                          className="text-xs text-graphite opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          Borrar
                        </ConfirmButton>
                      </form>
                    </div>
                    <p className="whitespace-pre-line text-sm">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Seguimiento */}
          <section className={`card p-5 ${overdue ? "border-red-200" : ""}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Próximo seguimiento</h2>
              {c.next_follow_up_at && (
                <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-violet"}`}>
                  {followUpLabel(c.next_follow_up_at, today)}
                </span>
              )}
            </div>
            <form
              key={`${c.next_follow_up_at}-${c.follow_up_note}`}
              action={saveFollowUp.bind(null, c.id)}
              className="space-y-3"
            >
              <div>
                <label htmlFor="next_follow_up_at" className="label">
                  Fecha
                </label>
                <input
                  id="next_follow_up_at"
                  name="next_follow_up_at"
                  type="date"
                  defaultValue={c.next_follow_up_at ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="follow_up_note" className="label">
                  Qué hay que hacer
                </label>
                <textarea
                  id="follow_up_note"
                  name="follow_up_note"
                  rows={2}
                  defaultValue={c.follow_up_note ?? ""}
                  className="input resize-y"
                />
              </div>
              <SubmitButton className="btn-primary w-full">Guardar seguimiento</SubmitButton>
            </form>
            {c.next_follow_up_at && (
              <form action={completeFollowUp.bind(null, c.id)} className="mt-2">
                <SubmitButton className="btn-secondary w-full" pendingText="Marcando…">
                  ✓ Hecho (contactado hoy)
                </SubmitButton>
              </form>
            )}
            <p className="mt-3 text-xs text-graphite">Último contacto: {formatDate(c.last_contact_at)}</p>
          </section>

          {/* Contacto */}
          <section className="card p-5">
            <h2 className="section-title mb-2">Contacto</h2>
            <dl className="divide-y divide-line">
              <Row label="Persona">
                {c.contact_name ? `${c.contact_name}${c.contact_role ? ` · ${c.contact_role}` : ""}` : null}
              </Row>
              <Row label="Email">{c.email ? <ExtLink href={`mailto:${c.email}`}>{c.email}</ExtLink> : null}</Row>
              <Row label="Teléfono">{c.phone ? <ExtLink href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</ExtLink> : null}</Row>
              <Row label="Web">{c.website ? <ExtLink href={toUrl(c.website)}>{c.website}</ExtLink> : null}</Row>
              <Row label="Instagram">
                {c.instagram ? <ExtLink href={toUrl(c.instagram, "instagram")}>{c.instagram}</ExtLink> : null}
              </Row>
              <Row label="LinkedIn">
                {c.linkedin ? <ExtLink href={toUrl(c.linkedin, "linkedin")}>{c.linkedin}</ExtLink> : null}
              </Row>
            </dl>
          </section>

          <section className="space-y-3 px-1 text-xs text-graphite">
            <p>Creada el {formatDate(c.created_at)} · actualizada el {formatDate(c.updated_at)}</p>
            <form action={deleteCompany.bind(null, c.id)}>
              <ConfirmButton
                message={`¿Eliminar "${c.name}" y todas sus notas? No se puede deshacer.`}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Eliminar empresa
              </ConfirmButton>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
