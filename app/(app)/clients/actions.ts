"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { date, num, period, text, uuid } from "@/lib/forms";
import { isPaymentMethod, isPhase, monthLabel } from "@/lib/os";
import { monthlyTasks, onboardingTasks } from "@/lib/templates";
import { currentPeriod, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";

export type FormState = { error: string | null };

function clientFromForm(formData: FormData) {
  const phase = text(formData, "phase");
  const pm = text(formData, "payment_method");
  const fee = num(formData, "monthly_fee", { max: 1e7 });
  const months = num(formData, "min_months", { min: 1, max: 60 });
  const days = num(formData, "payment_days", { max: 365 });
  return {
    name: text(formData, "name", 200),
    legal_name: text(formData, "legal_name", 200),
    nif: text(formData, "nif", 30)?.toUpperCase() ?? null,
    address: text(formData, "address", 300),
    postal_code: text(formData, "postal_code", 20),
    city: text(formData, "city", 100),
    province: text(formData, "province", 100),
    country: text(formData, "country", 100) ?? "España",
    billing_email: text(formData, "billing_email", 200),
    contact_name: text(formData, "contact_name", 200),
    contact_email: text(formData, "contact_email", 200),
    contact_phone: text(formData, "contact_phone", 50),
    service: text(formData, "service", 100),
    phase: isPhase(phase) ? phase : "onboarding",
    owner_id: uuid(formData, "owner_id"),
    reviewer_id: uuid(formData, "reviewer_id"),
    start_date: date(formData, "start_date") ?? todayISO(),
    monthly_fee: fee,
    min_months: months === null ? null : Math.round(months),
    payment_method: isPaymentMethod(pm) ? pm : null,
    payment_days: days === null ? null : Math.round(days),
    notes: text(formData, "notes", 5000),
  };
}

function refresh(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/tasks");
  if (id) revalidatePath(`/clients/${id}`);
}

async function currentUserId(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function notifyAssignment(
  supabase: ReturnType<typeof createClient>,
  actor: string | null,
  clientId: string,
  name: string,
  ownerId: string | null,
  reviewerId: string | null,
) {
  await notify(supabase, {
    userId: ownerId,
    actorId: actor,
    kind: "cliente-asignado",
    title: `Eres responsable de ${name}`,
    body: "Te han asignado este cliente. Revisa sus tareas y documentos.",
    link: `/clients/${clientId}`,
  });
  await notify(supabase, {
    userId: reviewerId,
    actorId: actor,
    kind: "cliente-revisor",
    title: `Eres revisor de ${name}`,
    body: "Revisarás lo que salga hacia este cliente antes de enviarlo.",
    link: `/clients/${clientId}`,
  });
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = clientFromForm(formData);
  if (!values.name) return { error: "El nombre del cliente es obligatorio." };
  const companyId = uuid(formData, "company_id");

  const supabase = createClient();
  const actor = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...values, company_id: companyId })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear el cliente. Inténtalo de nuevo." };

  if (formData.get("generate_onboarding") === "on") {
    await supabase.from("tasks").insert(onboardingTasks(data.id, values.start_date, values.owner_id));
  }
  if (companyId) {
    await supabase.from("companies").update({ status: "ganado" }).eq("id", companyId);
  }
  await notifyAssignment(supabase, actor, data.id, values.name, values.owner_id, values.reviewer_id);

  refresh(data.id);
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = clientFromForm(formData);
  if (!values.name) return { error: "El nombre del cliente es obligatorio." };

  const supabase = createClient();
  const actor = await currentUserId(supabase);
  const { data: before } = await supabase.from("clients").select("owner_id, reviewer_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("clients").update(values).eq("id", id);
  if (error) return { error: "No se pudieron guardar los cambios." };

  await notifyAssignment(
    supabase,
    actor,
    id,
    values.name,
    before?.owner_id !== values.owner_id ? values.owner_id : null,
    before?.reviewer_id !== values.reviewer_id ? values.reviewer_id : null,
  );

  refresh(id);
  redirect(`/clients/${id}`);
}

export async function setPhase(id: string, formData: FormData) {
  const phase = formData.get("phase");
  if (!isPhase(phase)) return;
  const supabase = createClient();
  await supabase.from("clients").update({ phase }).eq("id", id);
  refresh(id);
}

export async function deleteClientAction(id: string) {
  const supabase = createClient();
  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", id);
  if (count) redirect(`/clients/${id}?error=facturas`);

  // Borra también los archivos de Storage del cliente.
  const { data: docs } = await supabase.from("documents").select("storage_path").eq("client_id", id).eq("kind", "archivo");
  const paths = (docs ?? []).map((d) => d.storage_path as string).filter(Boolean);
  if (paths.length) await supabase.storage.from("documents").remove(paths);

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) redirect(`/clients/${id}?error=borrar`);
  refresh();
  redirect("/clients");
}

/** Convierte una empresa del CRM en cliente, con sus datos ya rellenados. */
export async function convertCompany(companyId: string) {
  const supabase = createClient();
  const { data: existing } = await supabase.from("clients").select("id").eq("company_id", companyId).maybeSingle();
  if (existing) redirect(`/clients/${existing.id}`);
  redirect(`/clients/new?company=${companyId}`);
}

export async function generateOnboarding(clientId: string) {
  const supabase = createClient();
  const { data: c } = await supabase.from("clients").select("start_date, owner_id").eq("id", clientId).maybeSingle();
  if (!c) return;
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("kind", "onboarding");
  if (!count) await supabase.from("tasks").insert(onboardingTasks(clientId, c.start_date, c.owner_id));
  refresh(clientId);
}

export async function generateMonth(clientId: string, formData: FormData) {
  const p = period(formData, "period") ?? currentPeriod();
  const supabase = createClient();
  const { data: c } = await supabase.from("clients").select("owner_id").eq("id", clientId).maybeSingle();
  if (!c) return;
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("kind", "mensual")
    .eq("period", p);
  if (count) redirect(`/clients/${clientId}?tab=tareas&error=mes&period=${p}`);
  await supabase.from("tasks").insert(monthlyTasks(clientId, p, c.owner_id));
  refresh(clientId);
  redirect(`/clients/${clientId}?tab=tareas&ok=${encodeURIComponent(`Ciclo de ${monthLabel(p)} creado`)}`);
}

/** Genera el ciclo mensual para todos los clientes en producción o retención que aún no lo tengan. */
export async function generateMonthForAll(formData: FormData) {
  const p = period(formData, "period") ?? currentPeriod();
  const supabase = createClient();
  const { data: clients } = await supabase.from("clients").select("id, owner_id").in("phase", ["produccion", "retencion"]);
  const { data: existing } = await supabase.from("tasks").select("client_id").eq("kind", "mensual").eq("period", p);
  const done = new Set((existing ?? []).map((t) => t.client_id));
  const rows = (clients ?? []).filter((c) => !done.has(c.id)).flatMap((c) => monthlyTasks(c.id, p, c.owner_id));
  if (rows.length) await supabase.from("tasks").insert(rows);
  refresh();
  redirect(`/tasks?ok=${encodeURIComponent(`${rows.length / 5} ciclos de ${monthLabel(p)} creados`)}`);
}

export async function addTime(clientId: string, formData: FormData) {
  const hours = num(formData, "hours", { max: 24 }) ?? 0;
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return;
  const supabase = createClient();
  await supabase.from("time_entries").insert({
    client_id: clientId,
    minutes,
    work_date: date(formData, "work_date") ?? todayISO(),
    note: text(formData, "note", 300),
  });
  refresh(clientId);
}

export async function deleteTime(clientId: string, entryId: string) {
  const supabase = createClient();
  await supabase.from("time_entries").delete().eq("id", entryId).eq("client_id", clientId);
  refresh(clientId);
}
