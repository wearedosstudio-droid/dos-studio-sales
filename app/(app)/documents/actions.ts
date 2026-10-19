"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isFolder } from "@/lib/os";
import { text, uuid } from "@/lib/forms";
import { notify } from "@/lib/notify";

function refresh(clientId: string) {
  revalidatePath("/documents");
  revalidatePath(`/clients/${clientId}`);
}

async function tellOwner(supabase: ReturnType<typeof createClient>, clientId: string, name: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { data: c } = await supabase.from("clients").select("name, owner_id").eq("id", clientId).maybeSingle();
  if (!c) return;
  await notify(supabase, {
    userId: c.owner_id,
    actorId: auth.user?.id,
    kind: "documento",
    title: `Nuevo documento en ${c.name}`,
    body: name,
    link: `/clients/${clientId}?tab=documentos`,
  });
}

/** Registra un archivo que el navegador ya ha subido a Storage. */
export async function registerUpload(input: {
  clientId: string;
  folder: string;
  name: string;
  path: string;
  mime: string;
  size: number;
}): Promise<{ error: string | null }> {
  if (!isFolder(input.folder)) return { error: "Carpeta no válida." };
  if (!input.path.startsWith(`${input.clientId}/`)) return { error: "Ruta no válida." };
  const supabase = createClient();
  const { error } = await supabase.from("documents").insert({
    client_id: input.clientId,
    folder: input.folder,
    name: input.name.slice(0, 300),
    kind: "archivo",
    storage_path: input.path,
    mime: input.mime || null,
    size_bytes: input.size,
  });
  if (error) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: "No se pudo guardar el documento." };
  }
  await tellOwner(supabase, input.clientId, input.name);
  refresh(input.clientId);
  return { error: null };
}

export async function addLink(clientId: string, formData: FormData) {
  const url = text(formData, "url", 2000);
  const folder = text(formData, "folder");
  if (!url || !/^https?:\/\//i.test(url) || !isFolder(folder)) return;
  const name = text(formData, "name", 300) ?? url;
  const supabase = createClient();
  await supabase.from("documents").insert({ client_id: clientId, folder, name, kind: "enlace", url });
  await tellOwner(supabase, clientId, name);
  refresh(clientId);
}

export async function deleteDocument(formData: FormData) {
  const id = uuid(formData, "id");
  if (!id) return;
  const supabase = createClient();
  const { data: d } = await supabase.from("documents").select("client_id, storage_path").eq("id", id).maybeSingle();
  if (!d) return;
  if (d.storage_path) await supabase.storage.from("documents").remove([d.storage_path]);
  await supabase.from("documents").delete().eq("id", id);
  refresh(d.client_id);
}
