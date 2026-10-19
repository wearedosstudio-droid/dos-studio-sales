"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", data.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
