"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { PRIORITIES, SERVICES, STATUSES } from "@/lib/constants";
import type { Company } from "@/lib/types";
import type { FormState } from "@/app/(app)/companies/actions";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  company?: Company;
  cancelHref: string;
  submitLabel: string;
};

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  required,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-violet"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="input"
        {...(type === "number" ? { min: 0, step: "any", inputMode: "decimal" as const } : {})}
      />
    </div>
  );
}

function Area({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea id={name} name={name} rows={3} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="input resize-y" />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-graphite">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function CompanyForm({ action, company, cancelHref, submitLabel }: Props) {
  const [state, formAction] = useFormState(action, { error: null });
  const c = company;

  return (
    <form action={formAction} className="space-y-4">
      <Section title="Empresa" description="Lo mínimo para identificarla.">
        <Field name="name" label="Nombre" defaultValue={c?.name} required className="sm:col-span-2" />
        <Field name="sector" label="Sector" defaultValue={c?.sector} placeholder="Arquitectura, Clínicas…" />
        <Field name="city" label="Ciudad" defaultValue={c?.city ?? (c ? null : "Barcelona")} />
      </Section>

      <Section title="Oportunidad" description="Por qué está en el CRM y qué le ofrecemos.">
        <Area name="problem" label="Problema detectado" defaultValue={c?.problem} placeholder="Web antigua, no adaptada a móvil…" />
        <Area name="opportunity" label="Oportunidad" defaultValue={c?.opportunity} />
        <div>
          <label htmlFor="recommended_service" className="label">
            Servicio recomendado
          </label>
          <select id="recommended_service" name="recommended_service" defaultValue={c?.recommended_service ?? ""} className="input">
            <option value="">Sin definir</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {c?.recommended_service && !(SERVICES as readonly string[]).includes(c.recommended_service) && (
              <option value={c.recommended_service}>{c.recommended_service}</option>
            )}
          </select>
        </div>
        <Field name="potential_value" label="Valor potencial (€)" type="number" defaultValue={c?.potential_value} />
        <div>
          <label htmlFor="priority" className="label">
            Prioridad
          </label>
          <select id="priority" name="priority" defaultValue={c?.priority ?? "media"} className="input">
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-graphite">Alta solo con oportunidad clara y capacidad de inversión.</p>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Estado
          </label>
          <select id="status" name="status" defaultValue={c?.status ?? "nuevo"} className="input">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Contacto" description="Datos públicos y persona de contacto.">
        <Field name="contact_name" label="Persona de contacto" defaultValue={c?.contact_name} />
        <Field name="contact_role" label="Cargo" defaultValue={c?.contact_role} />
        <Field name="email" label="Email público" type="email" defaultValue={c?.email} />
        <Field name="phone" label="Teléfono público" type="tel" defaultValue={c?.phone} />
        <Field name="website" label="Web" defaultValue={c?.website} placeholder="empresa.com" />
        <Field name="instagram" label="Instagram" defaultValue={c?.instagram} placeholder="@usuario" />
        <Field name="linkedin" label="LinkedIn" defaultValue={c?.linkedin} className="sm:col-span-2" />
      </Section>

      <Section title="Seguimiento">
        <Field name="next_follow_up_at" label="Próximo seguimiento" type="date" defaultValue={c?.next_follow_up_at} />
        <Field name="last_contact_at" label="Último contacto" type="date" defaultValue={c?.last_contact_at} />
        <Area name="follow_up_note" label="Qué hay que hacer" defaultValue={c?.follow_up_note} />
      </Section>

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
