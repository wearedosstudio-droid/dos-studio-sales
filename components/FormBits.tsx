// Piezas de formulario compartidas (sirven en componentes de servidor y de cliente).

export function Field({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  required,
  className = "",
  hint,
  step,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  hint?: string;
  step?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-violet"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="input"
        {...(type === "number" ? { min: 0, step: step ?? "any", inputMode: "decimal" as const } : {})}
      />
      {hint && <p className="mt-1 text-[11px] text-graphite">{hint}</p>}
    </div>
  );
}

export function Area({
  name,
  label,
  defaultValue,
  placeholder,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="input resize-y" />
    </div>
  );
}

export function Choice({
  name,
  label,
  options,
  defaultValue,
  empty,
  className = "",
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  empty?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className="input">
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-graphite">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
