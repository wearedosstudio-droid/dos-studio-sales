// Constantes del sistema operativo de Dos Studio (clientes, tareas, documentos, facturas).
// Las plantillas de tareas siguen el Manual operativo.

export const PHASES = [
  { value: "onboarding", label: "Onboarding" },
  { value: "produccion", label: "Producción mensual" },
  { value: "retencion", label: "Retención" },
  { value: "pausado", label: "Pausado" },
  { value: "cerrado", label: "Cerrado" },
] as const;
export type Phase = (typeof PHASES)[number]["value"];
export const ACTIVE_PHASES: Phase[] = ["onboarding", "produccion", "retencion"];
export const phaseLabel = (v: string) => PHASES.find((p) => p.value === v)?.label ?? v;
export const isPhase = (v: unknown): v is Phase => PHASES.some((p) => p.value === v);

export const FOLDERS = [
  { value: "contrato", label: "Contrato y facturas" },
  { value: "onboarding", label: "Onboarding y estrategia" },
  { value: "marca", label: "Marca" },
  { value: "contenido", label: "Contenido" },
  { value: "informes", label: "Informes" },
  { value: "otros", label: "Otros" },
] as const;
export type Folder = (typeof FOLDERS)[number]["value"];
export const folderLabel = (v: string) => FOLDERS.find((f) => f.value === v)?.label ?? v;
export const isFolder = (v: unknown): v is Folder => FOLDERS.some((f) => f.value === v);

export const PAYMENT_METHODS = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "domiciliacion", label: "Domiciliación bancaria" },
  { value: "bizum", label: "Bizum" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "efectivo", label: "Efectivo" },
] as const;
export const paymentLabel = (v: string | null) => PAYMENT_METHODS.find((p) => p.value === v)?.label ?? v ?? "—";
export const isPaymentMethod = (v: unknown): v is string => PAYMENT_METHODS.some((p) => p.value === v);

export const INVOICE_STATUSES = [
  { value: "borrador", label: "Borrador" },
  { value: "emitida", label: "Pendiente de cobro" },
  { value: "cobrada", label: "Cobrada" },
  { value: "anulada", label: "Anulada" },
] as const;
export const invoiceStatusLabel = (v: string) => INVOICE_STATUSES.find((s) => s.value === v)?.label ?? v;

/** Tareas de onboarding: [días desde el inicio, título]. */
export const ONBOARDING_TEMPLATE: [number, string][] = [
  [0, "Crear la ficha del cliente y su carpeta de documentos"],
  [1, "Enviar email de bienvenida y formulario de onboarding"],
  [3, "Recibir accesos a redes (como socio) y recursos de marca"],
  [5, "Reunión de arranque (60 min)"],
  [8, "Auditoría de perfiles, 3 competidores y línea editorial"],
  [10, "Calendario del mes 1 y 3 piezas de muestra, con revisión cruzada"],
  [14, "Aprobación y programación: primera publicación"],
];

/** Ciclo mensual: [día del mes, título, ¿mover al hábil anterior?]. */
export const MONTHLY_TEMPLATE: [number, string, boolean][] = [
  [1, "Facturar la cuota mensual", false],
  [5, "Enviar informe del mes anterior y llamada de 20 min", true],
  [12, "Proponer temas y formatos del mes siguiente", true],
  [19, "Producir las piezas y revisión cruzada", true],
  [24, "Aprobación del cliente y programación del mes siguiente", true],
];

export const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1] ?? ""} ${y}`;
};
