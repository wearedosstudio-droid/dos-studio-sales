import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave service_role. Se salta RLS: SOLO para el cron diario
 * (que se ejecuta sin sesión de usuario). Nunca lo importes en un componente
 * de cliente ni en una página: la clave no debe salir del servidor.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
