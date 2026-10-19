import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { session, getSettings } from "@/lib/session";
import { getTeam } from "@/lib/team";
import type { Client } from "@/lib/types";
import { ClientForm } from "@/components/ClientForm";
import { updateClientAction } from "../../actions";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const { supabase, me } = await session();
  const [{ data }, team, settings] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    getTeam(supabase),
    getSettings(supabase),
  ]);
  if (!data) notFound();
  const client = data as Client;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Editar {client.name}</h1>
      </header>
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        client={client}
        team={team}
        me={me}
        cancelHref={`/clients/${client.id}`}
        submitLabel="Guardar cambios"
        defaults={{ payment_days: settings.default_payment_days, payment_method: settings.default_payment_method }}
      />
    </div>
  );
}
