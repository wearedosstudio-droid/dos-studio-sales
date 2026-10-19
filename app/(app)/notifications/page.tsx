import type { Metadata } from "next";
import Link from "next/link";
import { session } from "@/lib/session";
import type { Notification } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Empty } from "@/components/OS";
import { SubmitButton } from "@/components/SubmitButton";
import { markAllRead } from "./actions";

export const metadata: Metadata = { title: "Avisos" };

export default async function NotificationsPage() {
  const { supabase, me } = await session();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", me).order("created_at", { ascending: false }).limit(150);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Avisos</h1>
          <p className="mt-1 text-sm text-graphite">
            {unread ? `${unread} sin leer` : "Todo leído"} · Cambia cómo te llegan por email en{" "}
            <Link href="/settings" className="text-violet hover:underline">Ajustes</Link>.
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <SubmitButton className="btn-secondary" pendingText="Marcando…">Marcar todo como leído</SubmitButton>
          </form>
        )}
      </header>
      <section className="card px-5">
        {items.length === 0 ? (
          <Empty title="No tienes avisos.">Aquí llegarán asignaciones, vencimientos y cobros atrasados.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-violet"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link href={n.link} className="text-sm font-medium hover:text-violet">{n.title}</Link>
                  ) : (
                    <p className="text-sm font-medium">{n.title}</p>
                  )}
                  {n.body && <p className="text-sm text-graphite">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-graphite">{timeAgo(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
