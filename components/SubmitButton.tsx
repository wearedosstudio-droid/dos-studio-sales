"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

export function SubmitButton({ children, pendingText = "Guardando…", className = "btn-primary" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
