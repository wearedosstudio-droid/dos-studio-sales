"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  [
    { href: "/dashboard", label: "Inicio" },
    { href: "/tasks", label: "Tareas" },
    { href: "/notifications", label: "Avisos" },
  ],
  [
    { href: "/companies", label: "Comercial" },
    { href: "/clients", label: "Clientes" },
    { href: "/documents", label: "Documentos" },
    { href: "/invoices", label: "Facturas" },
  ],
  [
    { href: "/reports", label: "Informes" },
    { href: "/activity", label: "Actividad" },
    { href: "/settings", label: "Ajustes" },
  ],
];

export function Nav({ variant, unread = 0 }: { variant: "sidebar" | "top"; unread?: number }) {
  const pathname = usePathname();

  const link = (l: { href: string; label: string }) => {
    const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? "bg-violet-soft text-violet" : "text-graphite hover:bg-canvas hover:text-ink"
        }`}
      >
        {l.label}
        {l.href === "/notifications" && unread > 0 && (
          <span className="rounded-full bg-violet px-1.5 text-[11px] font-semibold tabular-nums text-white">{unread}</span>
        )}
      </Link>
    );
  };

  if (variant === "top") {
    return <nav className="-mx-1 flex gap-1 overflow-x-auto px-1">{GROUPS.flat().map(link)}</nav>;
  }
  return (
    <nav className="flex flex-col gap-4">
      {GROUPS.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.map(link)}
        </div>
      ))}
    </nav>
  );
}
