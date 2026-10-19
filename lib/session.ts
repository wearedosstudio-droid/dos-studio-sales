import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Settings } from "./types";

/** Cliente de Supabase + id del usuario actual (redirige a /login si no hay sesión). */
export async function session() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, me: data.user.id, email: data.user.email ?? "" };
}

export async function getSettings(supabase: ReturnType<typeof createClient>): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return (data ?? {
    legal_name: null, trade_name: "Dos Studio", nif: null, address: null, postal_code: null, city: null,
    province: null, country: "España", email: null, phone: null, website: null, iban: null,
    invoice_series: "DS", default_vat_rate: 21, default_irpf_rate: 0, default_payment_days: 15,
    default_payment_method: "transferencia", invoice_footer: null,
  }) as Settings;
}
