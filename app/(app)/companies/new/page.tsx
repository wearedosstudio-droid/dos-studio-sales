import type { Metadata } from "next";
import { CompanyForm } from "@/components/CompanyForm";
import { createCompany } from "../actions";

export const metadata: Metadata = { title: "Nueva empresa" };

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Nueva empresa</h1>
        <p className="mt-1 text-sm text-graphite">Solo el nombre es obligatorio. El resto se puede completar después.</p>
      </header>
      <CompanyForm action={createCompany} cancelHref="/companies" submitLabel="Crear empresa" />
    </div>
  );
}
