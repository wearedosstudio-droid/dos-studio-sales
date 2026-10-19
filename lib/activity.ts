import type { ActivityRow } from "./types";
import { statusLabel } from "./constants";
import { phaseLabel } from "./os";

const FIELDS: Record<string, string> = {
  name: "nombre", title: "título", status: "estado", phase: "fase", due_date: "vencimiento",
  assignee_id: "responsable", owner_id: "responsable", reviewer_id: "revisor", monthly_fee: "cuota",
  start_date: "inicio", min_months: "permanencia", nif: "NIF", legal_name: "razón social", address: "dirección",
  postal_code: "código postal", city: "ciudad", province: "provincia", billing_email: "email de facturación",
  contact_name: "contacto", contact_email: "email de contacto", contact_phone: "teléfono", service: "servicio",
  notes: "notas", payment_method: "forma de pago", payment_days: "días de pago", issue_date: "fecha de emisión",
  vat_rate: "IVA", irpf_rate: "IRPF", payment_note: "nota de pago", next_follow_up_at: "seguimiento",
  follow_up_note: "nota de seguimiento", last_contact_at: "último contacto", priority: "prioridad",
  potential_value: "valor potencial", description: "descripción", folder: "carpeta", period: "periodo",
};

const q = (s: string | null) => (s ? `«${s}»` : "");

/** Frase legible de un cambio del registro: "completó «Reunión de arranque»". */
export function describeActivity(a: ActivityRow): string {
  const label = a.label;
  const ch = a.changes ?? {};
  const after = (k: string) => (ch[k] ? (ch[k][1] as string) : undefined);

  if (a.entity === "invoices") {
    const n = label ?? "en borrador";
    if (a.action === "insert") return "creó una factura en borrador";
    if (a.action === "delete") return "borró una factura en borrador";
    const st = after("status");
    if (st === "emitida" && ch.status?.[0] === "borrador") return `emitió la factura ${n}`;
    if (st === "emitida") return `deshizo el cobro de la factura ${n}`;
    if (st === "cobrada") return `marcó como cobrada la factura ${n}`;
    if (st === "anulada") return `anuló la factura ${n}`;
  }
  if (a.entity === "tasks" && a.action === "update") {
    const st = after("status");
    if (st === "hecha") return `completó ${q(label)}`;
    if (st === "pendiente") return `reabrió ${q(label)}`;
  }
  if (a.entity === "clients" && a.action === "update" && after("phase")) {
    return `movió ${q(label)} a ${phaseLabel(after("phase")!)}`;
  }
  if (a.entity === "companies" && a.action === "update" && after("status")) {
    return `pasó ${q(label)} a ${statusLabel(after("status")!)} en el comercial`;
  }

  const noun: Record<string, string> = {
    companies: "la empresa", notes: "una nota", clients: "el cliente", tasks: "la tarea",
    documents: "el documento", invoices: "la factura", time_entries: "horas",
  };
  if (a.entity === "documents" && a.action === "insert") return `añadió el documento ${q(label)}`;
  if (a.entity === "time_entries" && a.action === "insert") return `registró horas${label ? ` (${label})` : ""}`;
  if (a.entity === "notes" && a.action === "insert") return "añadió una nota en el comercial";
  if (a.action === "insert") return `creó ${noun[a.entity] ?? a.entity} ${q(label)}`;
  if (a.action === "delete") return `borró ${noun[a.entity] ?? a.entity} ${q(label)}`;

  const fields = Object.keys(ch).map((k) => FIELDS[k] ?? k);
  return `cambió ${fields.slice(0, 3).join(", ")}${fields.length > 3 ? "…" : ""} de ${noun[a.entity] ?? a.entity} ${q(label)}`;
}

export function activityLink(a: ActivityRow): string | null {
  if (a.action === "delete") return null;
  if (a.entity === "companies" && a.entity_id) return `/companies/${a.entity_id}`;
  if (a.entity === "invoices" && a.entity_id) return `/invoices/${a.entity_id}`;
  if (a.client_id) return `/clients/${a.client_id}`;
  return null;
}
