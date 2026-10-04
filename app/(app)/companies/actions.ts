"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPriority, isStatus } from "@/lib/constants";
import { todayISO } from "@/lib/format";

export type FormState = { error: string | null };

function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function date(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function companyFromForm(formData: FormData) {
  const rawValue = text(formData, "potential_value");
  const potential = rawValue === null ? null : Number(rawValue.replace(",", "."));
  const status = text(formData, "status");
  const priority = text(formData, "priority");

  return {
    name: text(formData, "name"),
    sector: text(formData, "sector"),
    city: text(formData, "city"),
    website: text(formData, "website"),
    instagram: text(formData, "instagram"),
    linkedin: text(formData, "linkedin"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    contact_name: text(formData, "contact_name"),
    contact_role: text(formData, "contact_role"),
    recommended_service: text(formData, "recommended_service"),
    problem: text(formData, "problem"),
    opportunity: text(formData, "opportunity"),
    priority: isPriority(priority) ? priority : "media",
    potential_value: potential !== null && Number.isFinite(potential) && potential >= 0 ? potential : null,
    status: isStatus(status) ? status : "nuevo",
    last_contact_at: date(formData, "last_contact_at"),
    next_follow_up_at: date(formData, "next_follow_up_at"),
    follow_up_note: text(formData, "follow_up_note"),
  };
}

function refresh(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/companies");
  if (id) revalidatePath(`/companies/${id}`);
}

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = companyFromForm(formData);
  if (!values.name) return { error: "El nombre de la empresa es obligatorio." };

  const supabase = createClient();
  const { data, error } = await supabase.from("companies").insert(values).select("id").single();

  if (error || !data) return { error: "No se pudo crear la empresa. Inténtalo de nuevo." };

  refresh(data.id);
  redirect(`/companies/${data.id}`);
}

export async function updateCompany(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = companyFromForm(formData);
  if (!values.name) return { error: "El nombre de la empresa es obligatorio." };

  const supabase = createClient();
  const { error } = await supabase.from("companies").update(values).eq("id", id);

  if (error) return { error: "No se pudieron guardar los cambios." };

  refresh(id);
  redirect(`/companies/${id}`);
}

/** Cambio rápido de estado desde la ficha. Si pasa a "contactado", registra el contacto de hoy. */
export async function setStatus(id: string, formData: FormData) {
  const status = formData.get("status");
  if (!isStatus(status)) return;

  const patch: Record<string, string> = { status };
  if (status === "contactado") patch.last_contact_at = todayISO();

  const supabase = createClient();
  await supabase.from("companies").update(patch).eq("id", id);
  refresh(id);
}

/** Guarda el próximo seguimiento desde la ficha. */
export async function saveFollowUp(id: string, formData: FormData) {
  const supabase = createClient();
  await supabase
    .from("companies")
    .update({
      next_follow_up_at: date(formData, "next_follow_up_at"),
      follow_up_note: text(formData, "follow_up_note"),
    })
    .eq("id", id);
  refresh(id);
}

/** Marca el seguimiento como hecho: último contacto = hoy y limpia el próximo. */
export async function completeFollowUp(id: string) {
  const supabase = createClient();
  await supabase
    .from("companies")
    .update({ last_contact_at: todayISO(), next_follow_up_at: null, follow_up_note: null })
    .eq("id", id);
  refresh(id);
}

export async function addNote(companyId: string, formData: FormData) {
  const body = text(formData, "body");
  if (!body) return;

  const supabase = createClient();
  await supabase.from("notes").insert({ company_id: companyId, body: body.slice(0, 5000) });
  refresh(companyId);
}

export async function deleteNote(companyId: string, noteId: string) {
  const supabase = createClient();
  await supabase.from("notes").delete().eq("id", noteId).eq("company_id", companyId);
  refresh(companyId);
}

export async function deleteCompany(id: string) {
  const supabase = createClient();
  await supabase.from("companies").delete().eq("id", id);
  refresh();
  redirect("/companies");
}
