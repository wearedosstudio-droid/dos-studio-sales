import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { CompanyForm } from "@/components/CompanyForm";
import { updateCompany } from "../../actions";

export const metadata: Metadata = { title: "Editar empresa" };

export default async function EditCompanyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("companies").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const company = data as Company;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Editar · {company.name}</h1>
      </header>
      <CompanyForm
        action={updateCompany.bind(null, company.id)}
        company={company}
        cancelHref={`/companies/${company.id}`}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
