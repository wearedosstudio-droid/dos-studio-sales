const TZ = "Europe/Madrid";

/** Fecha de hoy en Barcelona como YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-10-04" → "4 oct 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Etiqueta relativa para un seguimiento: "Vencido hace 2 días", "Hoy", "Mañana", "En 3 días". */
export function followUpLabel(iso: string, today = todayISO()): string {
  const diff = Math.round(
    (Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
  );
  if (diff < -1) return `Vencido hace ${-diff} días`;
  if (diff === -1) return "Vencido ayer";
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
}

/** Convierte "midominio.com" o "@usuario" en un enlace usable. */
export function toUrl(value: string, kind: "web" | "instagram" | "linkedin" = "web"): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === "instagram" && !v.includes(".")) {
    return `https://instagram.com/${v.replace(/^@/, "")}`;
  }
  return `https://${v}`;
}
