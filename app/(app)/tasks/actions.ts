"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { date, text, uuid } from "@/lib/forms";
import { formatDate, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";

function refresh(clientId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function createTask(formData: FormData) {
  const title = text(formData, "title", 300);
  if (!title) return;
  const clientId = uuid(formData, "client_id");
  const assignee = uuid(formData, "assignee_id");
  const due = date(formData, "due_date") ?? todayISO();

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("tasks")
    .insert({
      client_id: clientId,
      title,
      description: text(formData, "description", 2000),
      kind: clientId ? "manual" : "interna",
      group_label: clientId ? "Tareas sueltas" : "Interna",
      due_date: due,
      assignee_id: assignee,
    })
    .select("id")
    .single();

  if (data) {
    let clientName = "";
    if (clientId) {
      const { data: c } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
      clientName = c?.name ? ` · ${c.name}` : "";
    }
    await notify(supabase, {
      userId: assignee,
      actorId: auth.user?.id,
      kind: "tarea-asignada",
      title: `Nueva tarea para ti: ${title}`,
      body: `Vence el ${formatDate(due)}${clientName}.`,
      link: clientId ? `/clients/${clientId}` : "/tasks",
    });
  }
  refresh(clientId);
}

export async function toggleTask(id: string) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: t } = await supabase.from("tasks").select("status, client_id").eq("id", id).maybeSingle();
  if (!t) return;
  const done = t.status !== "hecha";
  await supabase
    .from("tasks")
    .update(
      done
        ? { status: "hecha", completed_at: new Date().toISOString(), completed_by: auth.user?.id ?? null }
        : { status: "pendiente", completed_at: null, completed_by: null },
    )
    .eq("id", id);
  refresh(t.client_id);
}

export async function updateTask(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: before } = await supabase.from("tasks").select("assignee_id, client_id, title").eq("id", id).maybeSingle();
  if (!before) return;
  const assignee = uuid(formData, "assignee_id");
  const due = date(formData, "due_date");
  const patch: Record<string, unknown> = { assignee_id: assignee };
  if (due) patch.due_date = due;
  const title = text(formData, "title", 300);
  if (title) patch.title = title;
  await supabase.from("tasks").update(patch).eq("id", id);
  if (assignee && assignee !== before.assignee_id) {
    await notify(supabase, {
      userId: assignee,
      actorId: auth.user?.id,
      kind: "tarea-asignada",
      title: `Te han asignado: ${title ?? before.title}`,
      body: due ? `Vence el ${formatDate(due)}.` : undefined,
      link: before.client_id ? `/clients/${before.client_id}` : "/tasks",
    });
  }
  refresh(before.client_id);
}

export async function deleteTask(id: string) {
  const supabase = createClient();
  const { data: t } = await supabase.from("tasks").select("client_id").eq("id", id).maybeSingle();
  await supabase.from("tasks").delete().eq("id", id);
  refresh(t?.client_id);
}
