import type { Profile } from "@/lib/types";
import { initials, personName } from "@/lib/team";
import { invoiceStatusLabel, phaseLabel } from "@/lib/os";

const PHASE_STYLES: Record<string, string> = {
  onboarding: "bg-violet-soft text-violet",
  produccion: "bg-emerald-50 text-emerald-700",
  retencion: "bg-sky-50 text-sky-700",
  pausado: "bg-amber-50 text-amber-700",
  cerrado: "bg-zinc-100 text-zinc-500",
};

export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_STYLES[phase] ?? "bg-zinc-100"}`}>
      {phaseLabel(phase)}
    </span>
  );
}

const INVOICE_STYLES: Record<string, string> = {
  borrador: "bg-zinc-100 text-zinc-600",
  emitida: "bg-amber-50 text-amber-700",
  cobrada: "bg-emerald-50 text-emerald-700",
  anulada: "bg-zinc-100 text-zinc-400 line-through",
};

export function InvoiceBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (status === "emitida" && overdue) {
    return <span className="inline-flex whitespace-nowrap rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Vencida</span>;
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${INVOICE_STYLES[status] ?? ""}`}>
      {invoiceStatusLabel(status)}
    </span>
  );
}

const AVATAR_COLORS = ["bg-violet text-white", "bg-ink text-white", "bg-emerald-600 text-white", "bg-sky-600 text-white"];

export function Avatar({ team, id, me, size = "sm" }: { team: Record<string, Profile>; id: string | null | undefined; me?: string; size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  if (!id) {
    return <span title="Sin asignar" className={`inline-grid shrink-0 place-content-center rounded-full border border-dashed border-graphite/40 text-graphite ${dims}`}>–</span>;
  }
  const idx = Object.keys(team).indexOf(id);
  return (
    <span title={personName(team, id, me)} className={`inline-grid shrink-0 place-content-center rounded-full font-semibold ${AVATAR_COLORS[(idx < 0 ? 0 : idx) % AVATAR_COLORS.length]} ${dims}`}>
      {initials(team, id)}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="py-8 text-sm text-graphite">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

export function PersonSelect({
  team,
  name,
  defaultValue,
  me,
  label,
  id,
}: {
  team: Record<string, Profile>;
  name: string;
  defaultValue?: string | null;
  me?: string;
  label?: string;
  id?: string;
}) {
  return (
    <select id={id ?? name} name={name} defaultValue={defaultValue ?? ""} aria-label={label} className="input">
      <option value="">Sin asignar</option>
      {Object.values(team).map((p) => (
        <option key={p.id} value={p.id}>
          {personName(team, p.id, me)}
        </option>
      ))}
    </select>
  );
}
