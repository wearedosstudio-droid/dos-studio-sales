"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/session";
import { date, num, period as periodField, uuid } from "@/lib/forms";
import { ACTIVE_PHASES, isPaymentMethod, monthLabel } from "@/lib/os";
import { addDaysISO, currentPeriod, todayISO } from "@/lib/format";

function refresh(id?: string, clientId?: string) {
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  if (id) revalidatePath(`/invoices/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

const back = (id: string, error: string) => redirect(`/invoices/${id}?error=${encodeURIComponent(error)}`);

type ClientBilling = {
  id: string;
  name: string;
  service: string | null;
  monthly_fee: number | null;
  payment_method: string | null;
  payment_days: number | null;
};

/** Crea un borrador con las condiciones del cliente (o las de Ajustes). */
async function createDraft(
  supabase: ReturnType<typeof createClient>,
  client: ClientBilling,
  opts: { period?: string | null; withFee?: boolean },
) {
  const s = await getSettings(supabase);
  const issue = todayISO();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      client_id: client.id,
      issue_date: issue,
      due_date: addDaysISO(issue, client.payment_days ?? s.default_payment_days),
      payment_method: client.payment_method ?? s.default_payment_method,
      vat_rate: s.default_vat_rate,
      irpf_rate: s.default_irpf_rate,
      period: opts.period ?? null,
      source: opts.withFee ? "cuota" : "manual",
    })
    .select("id")
    .single();
  if (error || !data) return null;
  if (opts.withFee && client.monthly_fee) {
    await supabase.from("invoice_lines").insert({
      invoice_id: data.id,
      description: `${client.service ?? "Servicios de marketing digital"} · ${monthLabel(opts.period ?? currentPeriod())}`,
      quantity: 1,
      unit_price: client.monthly_fee,
      sort: 0,
    });
  }
  return data.id as string;
}

export async function createInvoice(formData: FormData) {
  const clientId = uuid(formData, "client_id");
  if (!clientId) redirect("/invoices/new?error=cliente");
  const supabase = createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, service, monthly_fee, payment_method, payment_days")
    .eq("id", clientId!)
    .maybeSingle();
  if (!client) redirect("/invoices/new?error=cliente");

  const withFee = formData.get("kind") === "cuota";
  const p = periodField(formData, "period") ?? currentPeriod();
  if (withFee) {
    const { data: dup } = await supabase
      .from("invoices")
      .select("id")
      .eq("client_id", clientId!)
      .eq("source", "cuota")
      .eq("period", p)
      .neq("status", "anulada")
      .maybeSingle();
    if (dup) redirect(`/invoices/${dup.id}?error=${encodeURIComponent(`Ya existe la factura de cuota de ${monthLabel(p)}.`)}`);
  }
  const id = await createDraft(supabase, client as ClientBilling, { period: withFee ? p : null, withFee });
  if (!id) redirect("/invoices/new?error=crear");
  refresh(id!, clientId!);
  redirect(`/invoices/${id}`);
}

/** Borradores de cuota del mes para todos los clientes activos con cuota. */
export async function generateMonthlyInvoices(formData: FormData) {
  const p = periodField(formData, "period") ?? currentPeriod();
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, service, monthly_fee, payment_method, payment_days")
    .in("phase", ACTIVE_PHASES)
    .gt("monthly_fee", 0);
  const { data: existing } = await supabase
    .from("invoices")
    .select("client_id")
    .eq("source", "cuota")
    .eq("period", p)
    .neq("status", "anulada");
  const done = new Set((existing ?? []).map((i) => i.client_id));
  let n = 0;
  for (const c of (clients ?? []) as ClientBilling[]) {
    if (done.has(c.id)) continue;
    if (await createDraft(supabase, c, { period: p, withFee: true })) n++;
  }
  refresh();
  redirect(
    `/invoices?status=borrador&ok=${encodeURIComponent(
      n ? `${n} ${n === 1 ? "borrador creado" : "borradores creados"} para ${monthLabel(p)}. Revísalos y emítelos.` : `Todas las cuotas de ${monthLabel(p)} ya tenían factura.`,
    )}`,
  );
}

export type DraftInput = {
  issue_date: string;
  due_date: string;
  payment_method: string;
  payment_note: string;
  notes: string;
  period: string;
  vat_rate: number;
  irpf_rate: number;
  lines: { description: string; quantity: number; unit_price: number }[];
};

/** Guarda un borrador desde el editor. */
export async function saveDraft(id: string, input: DraftInput): Promise<{ error: string | null }> {
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(input.issue_date) || !isDate(input.due_date)) return { error: "Revisa las fechas." };
  if (input.due_date < input.issue_date) return { error: "El vencimiento no puede ser anterior a la fecha de emisión." };
  if (!isPaymentMethod(input.payment_method)) return { error: "Elige una forma de pago." };
  const pct = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  if (!pct(input.vat_rate) || !pct(input.irpf_rate)) return { error: "IVA e IRPF deben estar entre 0 y 100." };
  const lines = input.lines
    .map((l, i) => ({
      invoice_id: id,
      description: String(l.description ?? "").trim().slice(0, 500),
      quantity: Math.round(Number(l.quantity) * 100) / 100,
      unit_price: Math.round(Number(l.unit_price) * 100) / 100,
      sort: i,
    }))
    .filter((l) => l.description);
  if (lines.some((l) => !(l.quantity > 0) || !Number.isFinite(l.unit_price))) {
    return { error: "Cada concepto necesita una cantidad mayor que 0 y un precio." };
  }

  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("status, client_id").eq("id", id).maybeSingle();
  if (!inv) return { error: "Factura no encontrada." };
  if (inv.status !== "borrador") return { error: "Solo se pueden editar borradores." };

  const { error } = await supabase
    .from("invoices")
    .update({
      issue_date: input.issue_date,
      due_date: input.due_date,
      payment_method: input.payment_method,
      payment_note: input.payment_note.trim().slice(0, 500) || null,
      notes: input.notes.trim().slice(0, 2000) || null,
      period: /^\d{4}-\d{2}$/.test(input.period) ? input.period : null,
      vat_rate: input.vat_rate,
      irpf_rate: input.irpf_rate,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar la factura." };

  await supabase.from("invoice_lines").delete().eq("invoice_id", id);
  if (lines.length) {
    const { error: e2 } = await supabase.from("invoice_lines").insert(lines);
    if (e2) return { error: "No se pudieron guardar los conceptos." };
  }
  refresh(id, inv.client_id);
  return { error: null };
}

export async function issueInvoice(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("issue_invoice", { inv_id: id });
  if (error) back(id, error.message);
  refresh(id);
  redirect(`/invoices/${id}?ok=emitida`);
}

export async function markPaid(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("total, client_id").eq("id", id).maybeSingle();
  if (!inv) return;
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "cobrada",
      paid_at: date(formData, "paid_at") ?? todayISO(),
      paid_amount: num(formData, "paid_amount", { max: 1e9 }) ?? inv.total,
    })
    .eq("id", id)
    .eq("status", "emitida");
  if (error) back(id, error.message);
  refresh(id, inv.client_id);
}

export async function unmarkPaid(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "emitida", paid_at: null, paid_amount: null })
    .eq("id", id)
    .eq("status", "cobrada");
  if (error) back(id, error.message);
  refresh(id);
}

export async function cancelInvoice(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("invoices").update({ status: "anulada" }).eq("id", id).eq("status", "emitida");
  if (error) back(id, error.message);
  refresh(id);
}

export async function deleteDraft(id: string) {
  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("status", "borrador");
  if (error) back(id, error.message);
  refresh(undefined, inv?.client_id);
  redirect("/invoices");
}

/** Copia una factura como borrador nuevo con fecha de hoy. */
export async function duplicateInvoice(id: string) {
  const supabase = createClient();
  const [{ data: inv }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_lines").select("description, quantity, unit_price, sort").eq("invoice_id", id).order("sort"),
  ]);
  if (!inv) return;
  const issue = todayISO();
  const days = Math.max(0, Math.round((Date.parse(inv.due_date) - Date.parse(inv.issue_date)) / 86_400_000));
  const { data: copy } = await supabase
    .from("invoices")
    .insert({
      client_id: inv.client_id,
      issue_date: issue,
      due_date: addDaysISO(issue, days),
      payment_method: inv.payment_method,
      payment_note: inv.payment_note,
      notes: inv.notes,
      vat_rate: inv.vat_rate,
      irpf_rate: inv.irpf_rate,
    })
    .select("id")
    .single();
  if (!copy) back(id, "No se pudo duplicar la factura.");
  if (lines?.length) await supabase.from("invoice_lines").insert(lines.map((l) => ({ ...l, invoice_id: copy!.id })));
  refresh(copy!.id, inv.client_id);
  redirect(`/invoices/${copy!.id}`);
}
