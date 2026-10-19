import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para el navegador (subida directa de archivos a Storage). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
