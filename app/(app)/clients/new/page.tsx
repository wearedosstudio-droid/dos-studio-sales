import type { Metadata } from "next";
import { session, getSettings } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { Client } from "@/lib/types";
import { ClientForm } from "@/components/ClientForm";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage({ searchParams }: { searchParams: { company?: string } }) {
  const { supabase, me } = await session();
  const [team, settings] = await Promise.all([getTeam(supabase), getSettings(supabase)]);

  // Si viene del CRM, rellenamos con los datos de la empresa.
  let prefill: Partial<Client> | undefined;
  let from: string | null = null;
  if (searchParams.company && /^[0-9a-f-]{36}$/i.test(searchParams.company)) {
    const { data: co } = await supabase.from("companies").select("*").eq("id", searchParams.company).maybeSingle();
    if (co) {
      from = co.name;
      prefill = {
        company_id: co.id,
        name: co.name,
        city: co.city,
        service: co.recommended_service,
        monthly_fee: co.potential_value,
        contact_name: co.contact_name,
        contact_email: co.email,
        contact_phone: co.phone,
        notes: [co.problem && `Problema: ${co.problem}`, co.opportunity && `Oportunidad: ${co.opportunity}`].filter(Boolean).join("\n") || null,
      };
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-graphite">
          {from ? `Datos traídos de la empresa «${from}» del comercial. Revisa la cuota y completa la facturación.` : "Solo el nombre es obligatorio. Los datos fiscales hacen falta para facturar."}
        </p>
      </header>
      <ClientForm
        action={createClientAction}
        client={prefill}
        team={team}
        me={me}
        isNew
        cancelHref="/clients"
        submitLabel="Crear cliente"
        defaults={{ payment_days: settings.default_payment_days, payment_method: settings.default_payment_method }}
      />
    </div>
  );
}
