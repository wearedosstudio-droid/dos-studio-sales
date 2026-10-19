import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { renderEmail, sendEmail } from "@/lib/email";
import { addDaysISO, addMonths, daysBetween, formatDate, formatMoneyExact, todayISO } from "@/lib/format";
import { ACTIVE_PHASES, monthLabel } from "@/lib/os";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Event = { to: string[]; kind: string; key: string; title: string; body?: string; link?: string };

/**
 * Cron diario (Vercel Cron, ver vercel.json). Busca lo que vence y avisa:
 * - modo "evento": un email por cada aviso nuevo, al momento;
 * - modo "resumen": un único email con todos sus avisos nuevos del día.
 * Cada aviso tiene una clave única, así que nunca se envía dos veces.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayISO();
  const period = today.slice(0, 7);

  const [{ data: profiles }, { data: clients }, { data: tasks }, { data: invoices }, { data: companies }] = await Promise.all([
    db.from("profiles").select("id, email, email_mode, full_name"),
    db.from("clients").select("id, name, phase, owner_id, start_date, min_months, monthly_fee"),
    db.from("tasks").select("id, title, due_date, assignee_id, client_id").eq("status", "pendiente").lte("due_date", today),
    db.from("invoices").select("id, number, client_id, client_name, due_date, total").eq("status", "emitida").lte("due_date", today),
    db
      .from("companies")
      .select("id, name, status, next_follow_up_at, follow_up_note")
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", today),
  ]);

  const everyone = (profiles ?? []).map((p) => p.id as string);
  const clientById = new Map((clients ?? []).map((c) => [c.id as string, c]));
  const ownerOf = (clientId: string | null) => {
    const o = clientId ? clientById.get(clientId)?.owner_id : null;
    return o ? [o as string] : everyone;
  };
  const events: Event[] = [];

  for (const t of tasks ?? []) {
    const c = t.client_id ? clientById.get(t.client_id) : null;
    if (c?.phase === "cerrado") continue;
    const to = t.assignee_id ? [t.assignee_id as string] : ownerOf(t.client_id);
    const where = c ? ` · ${c.name}` : "";
    if (t.due_date === today) {
      events.push({ to, kind: "tarea-hoy", key: `task-due:${t.id}:${t.due_date}`, title: `Vence hoy: ${t.title}`, body: `Tarea${where}.`, link: c ? `/clients/${c.id}` : "/tasks" });
    } else {
      events.push({ to, kind: "tarea-vencida", key: `task-overdue:${t.id}:${t.due_date}`, title: `Tarea vencida: ${t.title}`, body: `Venció el ${formatDate(t.due_date)}${where}.`, link: c ? `/clients/${c.id}` : "/tasks" });
    }
  }

  for (const i of invoices ?? []) {
    const days = daysBetween(i.due_date, today);
    const who = i.client_name ?? clientById.get(i.client_id)?.name ?? "un cliente";
    const base = { to: ownerOf(i.client_id), link: `/invoices/${i.id}` };
    if (days === 0) {
      events.push({ ...base, kind: "factura-vence", key: `inv-due:${i.id}`, title: `Hoy vence la factura ${i.number} de ${who}`, body: `${formatMoneyExact(i.total)}. Si no llega el pago, recuérdaselo mañana.` });
    } else {
      // Primer aviso al vencer y recordatorios a los 15 y 30 días.
      const step = days >= 30 ? 30 : days >= 15 ? 15 : 1;
      events.push({ ...base, kind: "factura-vencida", key: `inv-overdue-${step}:${i.id}`, title: `Factura ${i.number} de ${who} vencida hace ${days} días`, body: `${formatMoneyExact(i.total)} pendientes de cobro.` });
    }
  }

  for (const co of companies ?? []) {
    if (["ganado", "perdido", "pausado"].includes(co.status)) continue;
    const late = co.next_follow_up_at < today;
    events.push({
      to: everyone,
      kind: "seguimiento",
      key: `follow:${co.id}:${co.next_follow_up_at}`,
      title: `${late ? "Seguimiento atrasado" : "Seguimiento hoy"}: ${co.name}`,
      body: co.follow_up_note ?? undefined,
      link: `/companies/${co.id}`,
    });
  }

  const in30 = addDaysISO(today, 30);
  for (const c of clients ?? []) {
    if (!c.min_months || !(ACTIVE_PHASES as string[]).includes(c.phase)) continue;
    const end = `${addMonths(String(c.start_date).slice(0, 7), c.min_months)}-01`;
    if (end >= today && end <= in30) {
      events.push({ to: ownerOf(c.id), kind: "renovacion", key: `renew:${c.id}:${end}`, title: `La permanencia de ${c.name} termina el ${formatDate(end)}`, body: "Buen momento para la conversación de renovación.", link: `/clients/${c.id}` });
    }
  }

  // A primeros de mes: crear los borradores de cuotas.
  if (Number(today.slice(8)) <= 3 && (clients ?? []).some((c) => Number(c.monthly_fee) > 0 && (ACTIVE_PHASES as string[]).includes(c.phase))) {
    events.push({ to: everyone, kind: "cuotas", key: `cuotas:${period}`, title: `Toca facturar las cuotas de ${monthLabel(period)}`, body: "Crea los borradores desde Facturas y emítelos.", link: "/invoices" });
  }

  // Enviar: "evento" recibe el email dentro de notify(); "resumen" se agrupa al final.
  const digest = new Map<string, Event[]>();
  const modes = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  let created = 0;
  for (const e of events) {
    for (const uid of e.to) {
      const isNew = await notify(db, { userId: uid, kind: e.kind, title: e.title, body: e.body, link: e.link, dedupeKey: `${e.key}:${uid}` });
      if (!isNew) continue;
      created++;
      if (modes.get(uid)?.email_mode === "resumen") digest.set(uid, [...(digest.get(uid) ?? []), e]);
    }
  }

  let digests = 0;
  for (const [uid, list] of Array.from(digest.entries())) {
    const p = modes.get(uid);
    if (!p?.email) continue;
    const ok = await sendEmail(
      p.email,
      `Dos Studio OS · ${list.length} ${list.length === 1 ? "aviso" : "avisos"} para hoy`,
      renderEmail({
        heading: `Buenos días${p.full_name ? `, ${p.full_name}` : ""}`,
        intro: "Esto es lo que vence o se ha atrasado:",
        items: list.map((e) => ({ title: e.title, detail: e.body, link: e.link })),
        cta: { label: "Abrir el panel", href: "/dashboard" },
      }),
    );
    if (ok) {
      digests++;
      await db
        .from("notifications")
        .update({ emailed_at: new Date().toISOString() })
        .eq("user_id", uid)
        .in("dedupe_key", list.map((e) => `${e.key}:${uid}`));
    }
  }

  return NextResponse.json({ ok: true, date: today, events: events.length, created, digests });
}
