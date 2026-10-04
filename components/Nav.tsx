"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/companies", label: "Empresas" },
];

export function Nav({ variant }: { variant: "sidebar" | "top" }) {
  const pathname = usePathname();

  return (
    <nav className={variant === "sidebar" ? "flex flex-col gap-1" : "flex gap-1"}>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-violet-soft text-violet" : "text-graphite hover:bg-canvas hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
