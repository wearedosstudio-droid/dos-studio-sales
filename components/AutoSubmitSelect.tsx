"use client";

import { useFormStatus } from "react-dom";

/** Selector que guarda al cambiar (va dentro de un <form> con server action). */
export function AutoSubmitSelect({
  name,
  value,
  options,
  label,
  className = "input w-auto cursor-pointer py-1.5 pr-8 font-medium",
}: {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
