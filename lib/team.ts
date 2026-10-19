import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

/** Los perfiles del equipo, por id. */
export async function getTeam(supabase: SupabaseClient): Promise<Record<string, Profile>> {
  const { data } = await supabase.from("profiles").select("id, email, full_name, email_mode").order("full_name");
  return Object.fromEntries(((data ?? []) as Profile[]).map((p) => [p.id, p]));
}

export function personName(team: Record<string, Profile>, id: string | null | undefined, me?: string): string {
  if (!id) return "Sin asignar";
  const p = team[id];
  const name = p?.full_name || p?.email?.split("@")[0] || "Socio";
  return id === me ? `${name} (tú)` : name;
}

export function initials(team: Record<string, Profile>, id: string | null | undefined): string {
  if (!id) return "–";
  const n = team[id]?.full_name || team[id]?.email || "?";
  return n
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
