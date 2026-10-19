import type { Metadata } from "next";
import { getSettings, session } from "@/lib/session";
import { PAYMENT_METHODS } from "@/lib/os";
import { emailEnabled } from "@/lib/email";
import { Choice, Field, Section } from "@/components/FormBits";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorNote } from "@/components/OS";
import { saveProfile, saveSettings } from "./actions";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const { supabase, me, email } = await session();
  const [s, { data: profile }] = await Promise.all([
    getSettings(supabase),
    supabase.from("profiles").select("full_name, email_mode").eq("id", me).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="mt-1 text-sm text-graphite">Tus avisos y los datos de la agencia que aparecen en las facturas.</p>
      </header>
      {searchParams.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Cambios guardados.</p>}
      {searchParams.error && <ErrorNote>No se pudieron guardar los ajustes.</ErrorNote>}

      <form action={saveProfile} className="space-y-4">
        <Section title="Tu perfil" description={email}>
          <Field name="full_name" label="Tu nombre" defaultValue={profile?.full_name} />
          <div>
            <label htmlFor="email_mode" className="label">Avisos por email</label>
            <select id="email_mode" name="email_mode" defaultValue={profile?.email_mode ?? "evento"} className="input">
              <option value="evento">Un email por cada evento</option>
              <option value="resumen">Un resumen cada mañana laborable</option>
              <option value="ninguno">Ninguno (solo en el panel)</option>
            </select>
            {!emailEnabled() && <p className="mt-1 text-[11px] text-amber-700">El envío de emails aún no está configurado (falta RESEND_API_KEY).</p>}
          </div>
        </Section>
        <div className="flex justify-end"><SubmitButton>Guardar perfil</SubmitButton></div>
      </form>

      <form action={saveSettings} className="space-y-4">
        <Section title="Datos fiscales" description="Obligatorios para emitir facturas. Se copian en cada factura al emitirla.">
          <Field name="legal_name" label="Razón social o nombre completo" defaultValue={s.legal_name} />
          <Field name="nif" label="NIF / CIF" defaultValue={s.nif} />
          <Field name="trade_name" label="Nombre comercial" defaultValue={s.trade_name} />
          <Field name="email" label="Email de facturación" type="email" defaultValue={s.email} />
          <Field name="address" label="Dirección" defaultValue={s.address} className="sm:col-span-2" />
          <Field name="postal_code" label="Código postal" defaultValue={s.postal_code} />
          <Field name="city" label="Ciudad" defaultValue={s.city ?? "Barcelona"} />
          <Field name="province" label="Provincia" defaultValue={s.province ?? "Barcelona"} />
          <Field name="country" label="País" defaultValue={s.country ?? "España"} />
          <Field name="phone" label="Teléfono" defaultValue={s.phone} />
          <Field name="website" label="Web" defaultValue={s.website} />
        </Section>
        <Section title="Condiciones por defecto" description="Cada cliente puede tener las suyas; en cada factura se pueden cambiar.">
          <Field name="iban" label="IBAN para transferencias" defaultValue={s.iban} className="sm:col-span-2" placeholder="ES00 0000 0000 0000 0000 0000" />
          <Choice name="default_payment_method" label="Forma de pago" options={PAYMENT_METHODS} defaultValue={s.default_payment_method} />
          <Field name="default_payment_days" label="Días para pagar" type="number" step="1" defaultValue={s.default_payment_days} />
          <Field name="default_vat_rate" label="IVA (%)" type="number" defaultValue={s.default_vat_rate} />
          <Field name="default_irpf_rate" label="Retención IRPF (%)" type="number" defaultValue={s.default_irpf_rate} hint="Solo si facturáis como profesionales a empresas. Consultadlo con vuestra gestoría." />
          <Field name="invoice_series" label="Serie de facturas" defaultValue={s.invoice_series} hint="Formato del número: SERIE-AÑO-0001. Cambiarla empieza una numeración nueva." />
          <div className="sm:col-span-2">
            <label htmlFor="invoice_footer" className="label">Pie de factura</label>
            <textarea id="invoice_footer" name="invoice_footer" rows={3} defaultValue={s.invoice_footer ?? ""} placeholder="Inscrita en el Registro Mercantil de Barcelona… / Texto de protección de datos" className="input resize-y" />
          </div>
        </Section>
        <div className="flex justify-end"><SubmitButton>Guardar datos de la agencia</SubmitButton></div>
      </form>
    </div>
  );
}
