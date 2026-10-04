import { priorityLabel, statusLabel } from "@/lib/constants";

const STATUS_STYLES: Record<string, string> = {
  nuevo: "bg-slate-100 text-slate-700",
  auditado: "bg-sky-50 text-sky-700",
  contactado: "bg-violet-soft text-violet",
  respondio: "bg-indigo-50 text-indigo-700",
  reunion: "bg-amber-50 text-amber-700",
  propuesta: "bg-orange-50 text-orange-700",
  negociacion: "bg-fuchsia-50 text-fuchsia-700",
  ganado: "bg-emerald-50 text-emerald-700",
  perdido: "bg-red-50 text-red-700",
  pausado: "bg-zinc-100 text-zinc-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  alta: "text-red-600",
  media: "text-amber-600",
  baja: "text-graphite",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${PRIORITY_STYLES[priority] ?? ""}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {priorityLabel(priority)}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded border border-dashed border-graphite/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-graphite">
      Demo
    </span>
  );
}
