"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { num, text } from "@/lib/forms";
import { isPaymentMethod } from "@/lib/os";

export async function saveSettings(formData: FormData) {
  const series = (text(formData, "invoice_series", 6) ?? "DS").toUpperCase().replace(/[^A-Z0-9]/g, "") || "DS";
  const pm = text(formData, "default_payment_method");
  const supabase = createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      legal_name: text(formData, "legal_name", 200),
      trade_name: text(formData, "trade_name", 100) ?? "Dos Studio",
      nif: text(formData, "nif", 30)?.toUpperCase() ?? null,
      address: text(formData, "address", 300),
      postal_code: text(formData, "postal_code", 20),
      city: text(formData, "city", 100),
      province: text(formData, "province", 100),
      country: text(formData, "country", 100) ?? "España",
      email: text(formData, "email", 200),
      phone: text(formData, "phone", 50),
      website: text(formData, "website", 200),
      iban: text(formData, "iban", 40)?.toUpperCase().replace(/\s+/g, " ") ?? null,
      invoice_series: series,
      default_vat_rate: num(formData, "default_vat_rate", { max: 100 }) ?? 21,
      default_irpf_rate: num(formData, "default_irpf_rate", { max: 100 }) ?? 0,
      default_payment_days: Math.round(num(formData, "default_payment_days", { max: 365 }) ?? 15),
      default_payment_method: isPaymentMethod(pm) ? pm : "transferencia",
      invoice_footer: text(formData, "invoice_footer", 1000),
    })
    .eq("id", 1);
  if (error) redirect("/settings?error=1");
  revalidatePath("/", "layout");
  redirect("/settings?ok=agencia");
}

export async function saveProfile(formData: FormData) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const mode = text(formData, "email_mode");
  await supabase
    .from("profiles")
    .update({
      full_name: text(formData, "full_name", 100),
      email_mode: mode === "resumen" || mode === "ninguno" ? mode : "evento",
    })
    .eq("id", data.user.id);
  revalidatePath("/", "layout");
  redirect("/settings?ok=perfil");
}
