import Link from "next/link";
import type { ActivityRow, Profile } from "@/lib/types";
import { activityLink, describeActivity } from "@/lib/activity";
import { personName } from "@/lib/team";
import { timeAgo } from "@/lib/format";
import { Avatar, Empty } from "./OS";

export function ActivityFeed({
  rows,
  team,
  me,
  clients,
}: {
  rows: ActivityRow[];
  team: Record<string, Profile>;
  me: string;
  clients?: Record<string, string>;
}) {
  if (!rows.length) return <Empty title="Sin actividad todavía.">Cada cambio quedará registrado aquí con quién y cuándo.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((a) => {
        const href = activityLink(a);
        const client = a.client_id && clients ? clients[a.client_id] : null;
        return (
          <li key={a.id} className="flex gap-3 py-3 text-sm">
            <Avatar team={team} id={a.actor_id} me={me} />
            <div className="min-w-0">
              <p>
                <span className="font-medium">{a.actor_id ? personName(team, a.actor_id) : "Sistema"}</span>{" "}
                {href ? (
                  <Link href={href} className="hover:text-violet">
                    {describeActivity(a)}
                  </Link>
                ) : (
                  describeActivity(a)
                )}
                {client && a.entity !== "clients" && <span className="text-graphite"> · {client}</span>}
              </p>
              <p className="text-xs text-graphite">{timeAgo(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
