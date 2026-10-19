import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre un documento: enlace externo o URL firmada de Storage válida 2 minutos. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", _req.url));

  const { data: doc } = await supabase.from("documents").select("kind, url, storage_path").eq("id", params.id).maybeSingle();
  if (!doc) return new NextResponse("Documento no encontrado", { status: 404 });
  if (doc.kind === "enlace" && doc.url) return NextResponse.redirect(doc.url);

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path!, 120);
  if (error || !data) return new NextResponse("No se pudo abrir el archivo", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
