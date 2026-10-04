"use client";

import { useFormStatus } from "react-dom";
import { STATUSES } from "@/lib/constants";

/** Selector de estado que guarda al cambiar (va dentro de un <form> con server action). */
export function StatusSelect({ value }: { value: string }) {
  const { pending } = useFormStatus();
  return (
    <select
      name="status"
      aria-label="Estado"
      defaultValue={value}
      disabled={pending}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="input w-auto cursor-pointer py-1.5 pr-8 font-medium"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
