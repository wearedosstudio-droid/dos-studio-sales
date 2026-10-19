/** Lectura segura de campos de formulario. */
export function text(formData: FormData, key: string, max = 2000): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v.slice(0, max);
}

export function date(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function period(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v && /^\d{4}-\d{2}$/.test(v) ? v : null;
}

export function num(formData: FormData, key: string, { min = 0, max = 1e9 } = {}): number | null {
  const v = text(formData, key);
  if (v === null) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function uuid(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
