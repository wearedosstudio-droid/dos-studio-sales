// Estados del pipeline. El orden importa: es el orden del embudo.
export const STATUSES = [
  { value: "nuevo", label: "Nuevo" },
  { value: "auditado", label: "Auditado" },
  { value: "contactado", label: "Contactado" },
  { value: "respondio", label: "Respondió" },
  { value: "reunion", label: "Reunión" },
  { value: "propuesta", label: "Propuesta" },
  { value: "negociacion", label: "Negociación" },
  { value: "ganado", label: "Ganado" },
  { value: "perdido", label: "Perdido" },
  { value: "pausado", label: "Pausado" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];

// Estados que forman el embudo activo (sin perdido / pausado).
export const PIPELINE_STATUSES: Status[] = [
  "nuevo",
  "auditado",
  "contactado",
  "respondio",
  "reunion",
  "propuesta",
  "negociacion",
  "ganado",
];

// Estados cerrados: no generan seguimientos pendientes en el dashboard.
export const CLOSED_STATUSES: Status[] = ["ganado", "perdido"];

export const PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
] as const;

export type Priority = (typeof PRIORITIES)[number]["value"];

// Servicios de Dos Studio. Los precios de SEO están PENDIENTES DE DEFINIR.
export const SERVICES = [
  "Starter (Redes)",
  "Growth (Redes)",
  "Premium (Redes)",
  "Web One Page",
  "Web Corporativa",
  "Ecommerce",
  "SEO",
] as const;

export function statusLabel(value: string): string {
  return STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function priorityLabel(value: string): string {
  return PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

export function isStatus(value: unknown): value is Status {
  return STATUSES.some((s) => s.value === value);
}

export function isPriority(value: unknown): value is Priority {
  return PRIORITIES.some((p) => p.value === value);
}
