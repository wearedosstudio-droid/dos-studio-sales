"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { SERVICES } from "@/lib/constants";
import { PAYMENT_METHODS, PHASES } from "@/lib/os";
import { personName } from "@/lib/team";
import type { Client, Profile } from "@/lib/types";
import type { FormState } from "@/app/(app)/clients/actions";
import { Area, Choice, Field, Section } from "./FormBits";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Partial<Client>;
  team: Record<string, Profile>;
  me: string;
  cancelHref: string;
  submitLabel: string;
  isNew?: boolean;
  defaults: { payment_days: number; payment_method: string };
};

export function ClientForm({ action, client, team, me, cancelHref, submitLabel, isNew, defaults }: Props) {
  const [state, formAction] = useFormState(action, { error: null });
  const c = client ?? {};
  const people = Object.values(team).map((p) => ({ value: p.id, label: personName(team, p.id, me) }));
  const other = Object.keys(team).find((id) => id !== me) ?? "";
  const services: { value: string; label: string }[] = SERVICES.map((s) => ({ value: s, label: s }));
  if (c.service && !(SERVICES as readonly string[]).includes(c.service)) services.push({ value: c.service, label: c.service });

  return (
    <form action={formAction} className="space-y-4">
      {c.company_id && <input type="hidden" name="company_id" value={c.company_id} />}

      <Section title="Cliente" description="Nombre comercial, servicio y fase.">
        <Field name="name" label="Nombre comercial" defaultValue={c.name} required className="sm:col-span-2" />
        <Choice name="service" label="Servicio contratado" options={services} defaultValue={c.service} empty="Sin definir" />
        <Choice name="phase" label="Fase" options={PHASES} defaultValue={c.phase ?? "onboarding"} />
        <Choice name="owner_id" label="Responsable" options={people} defaultValue={c.owner_id ?? (isNew ? me : "")} empty="Sin asignar" />
        <Choice name="reviewer_id" label="Revisor" options={people} defaultValue={c.reviewer_id ?? (isNew ? other : "")} empty="Sin asignar" />
      </Section>

      <Section title="Contrato" description="Cuota, permanencia y condiciones de cobro.">
        <Field name="start_date" label="Fecha de inicio" type="date" defaultValue={c.start_date} required />
        <Field name="monthly_fee" label="Cuota mensual sin IVA (€)" type="number" defaultValue={c.monthly_fee} hint="Vacío si es pago único (web, auditoría)." />
        <Field name="min_months" label="Permanencia (meses)" type="number" step="1" defaultValue={c.min_months} />
        <Choice name="payment_method" label="Forma de pago" options={PAYMENT_METHODS} defaultValue={c.payment_method ?? defaults.payment_method} />
        <Field name="payment_days" label="Días para pagar" type="number" step="1" defaultValue={c.payment_days ?? defaults.payment_days} hint="Vencimiento de sus facturas desde la fecha de emisión." />
      </Section>

      <Section title="Datos de facturación" description="Obligatorios para emitir facturas.">
        <Field name="legal_name" label="Razón social" defaultValue={c.legal_name} />
        <Field name="nif" label="NIF / CIF" defaultValue={c.nif} />
        <Field name="address" label="Dirección" defaultValue={c.address} className="sm:col-span-2" />
        <Field name="postal_code" label="Código postal" defaultValue={c.postal_code} />
        <Field name="city" label="Ciudad" defaultValue={c.city ?? "Barcelona"} />
        <Field name="province" label="Provincia" defaultValue={c.province ?? "Barcelona"} />
        <Field name="country" label="País" defaultValue={c.country ?? "España"} />
        <Field name="billing_email" label="Email de facturación" type="email" defaultValue={c.billing_email} className="sm:col-span-2" />
      </Section>

      <Section title="Contacto que aprueba" description="Un solo aprobador por cliente.">
        <Field name="contact_name" label="Nombre" defaultValue={c.contact_name} />
        <Field name="contact_phone" label="Teléfono" type="tel" defaultValue={c.contact_phone} />
        <Field name="contact_email" label="Email" type="email" defaultValue={c.contact_email} className="sm:col-span-2" />
        <Area name="notes" label="Notas internas" defaultValue={c.notes} placeholder="Tono, temas prohibidos, temporadas fuertes…" />
      </Section>

      {isNew && (
        <label className="card flex items-center gap-3 p-4 text-sm">
          <input type="checkbox" name="generate_onboarding" defaultChecked className="h-4 w-4 accent-violet" />
          Crear las 7 tareas de onboarding con fechas desde el día de inicio
        </label>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Link href={cancelHref} className="btn-secondary">
          Cancelar
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
