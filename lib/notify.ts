import type { SupabaseClient } from "@supabase/supabase-js";
import { renderEmail, sendEmail } from "./email";

export type NotifyInput = {
  userId: string | null | undefined;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  /** Si se repite, el aviso no se vuelve a crear ni a enviar. */
  dedupeKey?: string;
  /** Quien provoca el evento. Nadie recibe avisos de lo que hace él mismo. */
  actorId?: string | null;
};

/**
 * Crea un aviso en el panel y, si la persona tiene el modo "evento", se lo envía por email al momento.
 * Devuelve true si el aviso es nuevo.
 */
export async function notify(supabase: SupabaseClient, n: NotifyInput): Promise<boolean> {
  if (!n.userId || n.userId === n.actorId) return false;

  if (n.dedupeKey) {
    const { data: existing } = await supabase.from("notifications").select("id").eq("dedupe_key", n.dedupeKey).maybeSingle();
    if (existing) return false;
  }

  const { data: profile } = await supabase.from("profiles").select("email, email_mode").eq("id", n.userId).maybeSingle();
  let emailedAt: string | null = null;
  if (profile?.email && profile.email_mode === "evento") {
    const ok = await sendEmail(
      profile.email,
      n.title,
      renderEmail({ heading: n.title, intro: n.body, cta: n.link ? { label: "Abrir en el panel", href: n.link } : undefined }),
    );
    if (ok) emailedAt = new Date().toISOString();
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: n.userId,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    dedupe_key: n.dedupeKey ?? null,
    emailed_at: emailedAt,
  });
  return !error;
}
