import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invoiceStatusLabel, paymentLabel } from "@/lib/os";
import { formatDateNumeric } from "@/lib/format";

/** CSV de facturas emitidas de un año (separado por ";" y decimales con coma, para Excel en español). */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", req.url));

  const y = req.nextUrl.searchParams.get("year");
  const year = y && /^\d{4}$/.test(y) ? y : String(new Date().getFullYear());

  const { data } = await supabase
    .from("invoices")
    .select("number, issue_date, due_date, client_legal_name, client_name, client_nif, subtotal, vat_rate, vat_amount, irpf_rate, irpf_amount, total, status, payment_method, paid_at, paid_amount")
    .neq("status", "borrador")
    .gte("issue_date", `${year}-01-01`)
    .lte("issue_date", `${year}-12-31`)
    .order("seq");

  const n = (v: unknown) => (v === null || v === undefined ? "" : Number(v).toFixed(2).replace(".", ","));
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Número", "Fecha", "Vencimiento", "Cliente", "NIF", "Base imponible", "IVA %", "Cuota IVA", "IRPF %", "Retención IRPF", "Total", "Estado", "Forma de pago", "Fecha de cobro", "Importe cobrado"];
  const rows = (data ?? []).map((i) =>
    [
      i.number,
      formatDateNumeric(i.issue_date),
      formatDateNumeric(i.due_date),
      i.client_legal_name ?? i.client_name,
      i.client_nif,
      n(i.subtotal),
      n(i.vat_rate),
      n(i.vat_amount),
      n(i.irpf_rate),
      n(i.irpf_amount),
      n(i.total),
      invoiceStatusLabel(i.status),
      paymentLabel(i.payment_method),
      i.paid_at ? formatDateNumeric(i.paid_at) : "",
      n(i.paid_amount),
    ]
      .map(cell)
      .join(";"),
  );
  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturas-dos-studio-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
