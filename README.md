# Dos Studio Sales

Panel comercial interno de Dos Studio: empresas, oportunidades, pipeline y seguimientos.
Privado: todo requiere iniciar sesión. No es la web pública (esa vive en otro repositorio).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres) · Vercel.

## Qué incluye (V1.1)

- Login con Supabase Auth (email + contraseña). Todas las rutas protegidas.
- **Dashboard:** métricas, seguimientos vencidos y de los próximos 7 días, resumen del pipeline.
- **Empresas:** búsqueda, filtros por estado y prioridad, orden por seguimiento / recientes / nombre / valor.
- **Ficha de empresa:** oportunidad, cambio rápido de estado, seguimiento (con "Hecho"), notas, contacto.
- Crear, editar y eliminar empresas.

Pendiente para V1.2: auditorías, contactos múltiples, historial de actividad.

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE, p. ej. Frankfurt o París).
2. **SQL Editor** → pega y ejecuta `supabase/migrations/0001_init.sql`.
3. (Opcional) Ejecuta `supabase/seed_demo.sql` para tener empresas DEMO de prueba.
4. **Authentication → Sign In / Providers → Email:** desactiva **"Allow new users to sign up"**.
   Imprescindible: cualquier usuario autenticado ve todo el CRM.
5. **Authentication → Users → Add user** (o *Invite*) para cada socio.
6. **Project Settings → API:** copia `Project URL` y la clave `anon` / `publishable`.

### 2. Local

```bash
cp .env.example .env.local   # y rellena las dos variables
npm install
npm run dev                  # http://localhost:3000
```

### 3. Vercel

1. *Add New → Project* → importa `dos-studio-sales` desde GitHub (framework: Next.js, sin cambios).
2. *Environment Variables:* añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. *Deploy.*
4. Dominio: *Settings → Domains* → `app.dosstudiomkt.com`, y en tu proveedor DNS un registro
   `CNAME app → cname.vercel-dns.com` (Vercel te muestra el valor exacto).
5. En Supabase, **Authentication → URL Configuration → Site URL:** `https://app.dosstudiomkt.com`.

## Seguridad

- Secretos solo en `.env.local` y en las variables de Vercel. `.env*` está en `.gitignore`.
- La clave `anon` es pública por diseño; la protección real es el login + RLS en las tablas.
- Nunca uses la clave `service_role` en este proyecto.
- El panel envía `noindex` y no se puede incrustar en otras webs.

## Datos

Las empresas de prueba llevan `is_demo = true` y la etiqueta DEMO. Para borrarlas:

```sql
delete from public.companies where is_demo;
```
