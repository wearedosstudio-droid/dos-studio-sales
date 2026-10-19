import Link from "next/link";
import type { DocumentRow, Profile } from "@/lib/types";
import { folderLabel } from "@/lib/os";
import { personName } from "@/lib/team";
import { formatDateTime } from "@/lib/format";
import { deleteDocument } from "@/app/(app)/documents/actions";
import { ConfirmButton } from "./ConfirmButton";

export function DocList({ docs, team, me, clients }: { docs: DocumentRow[]; team: Record<string, Profile>; me: string; clients?: Record<string, string> }) {
  return (
    <ul className="divide-y divide-line">
      {docs.map((d) => {
        const ext = d.kind === "enlace" ? "URL" : (d.name.split(".").pop() ?? "").slice(0, 4).toUpperCase();
        return (
          <li key={d.id} className="group flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-content-center rounded-lg bg-canvas text-[10px] font-semibold text-graphite">{ext}</span>
            <div className="min-w-0 flex-1">
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-violet">
                {d.name}
              </a>
              <p className="text-xs text-graphite">
                {clients && <><Link href={`/clients/${d.client_id}?tab=documentos`} className="text-violet hover:underline">{clients[d.client_id]}</Link> · </>}
                {folderLabel(d.folder)} · {personName(team, d.uploaded_by, me)} · {formatDateTime(d.created_at)}
                {d.size_bytes ? ` · ${(d.size_bytes / 1048576).toFixed(1)} MB` : ""}
              </p>
            </div>
            <form action={deleteDocument}>
              <input type="hidden" name="id" value={d.id} />
              <ConfirmButton message={`¿Borrar «${d.name}»?`} className="text-xs text-graphite hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100">
                Borrar
              </ConfirmButton>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

