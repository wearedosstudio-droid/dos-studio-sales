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

/** Importe con céntimos: 1.234,50 €. Para facturas. */
export function formatMoneyExact(value: number | string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(
    Number(value),
  );
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Mueve una fecha que cae en fin de semana al lunes siguiente (dir = 1) o al viernes anterior (dir = -1). */
export function toWorkday(iso: string, dir: 1 | -1 = 1): string {
  let d = iso;
  for (let i = 0; i < 3; i++) {
    const day = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) return d;
    d = addDaysISO(d, dir);
  }
  return d;
}

/** "2026-10" del mes actual en Barcelona. */
export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

/** Suma meses a un periodo YYYY-MM. */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10-19" → "19/10/2026" (formato de factura). */
export function formatDateNumeric(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Minutos → "3 h 20 min". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "hace 5 min", "hace 2 h", o fecha y hora. */
export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return formatDateTime(iso);
}
