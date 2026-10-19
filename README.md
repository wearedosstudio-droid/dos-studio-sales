# Dos Studio OS

Sistema interno de Dos Studio: comercial, clientes, tareas, documentos, facturación, informes y avisos.
Privado: todo requiere iniciar sesión. No es la web pública (esa vive en otro repositorio).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Storage) · Vercel · Resend (emails).

## Módulos

| Módulo | Qué hace |
| --- | --- |
| **Inicio** | Tus tareas vencidas y de los próximos 3 días, seguimientos comerciales, cobros vencidos, avisos y actividad. |
| **Comercial** | El CRM de siempre: empresas, pipeline, seguimientos y notas. Desde una empresa en propuesta, negociación o ganada se crea el cliente con un clic. |
| **Clientes** | Fase, responsable y revisor, cuota, permanencia, datos fiscales. Ficha con pestañas de tareas, documentos, facturas, horas e historial. |
| **Tareas** | Plantillas del Manual operativo: onboarding (7 tareas) y ciclo mensual (5 tareas) con fechas en días laborables. Vista «Mías» y «Todo el equipo». |
| **Documentos** | Archivos privados en Supabase Storage (hasta 50 MB) o enlaces a Drive/Figma/Canva, por cliente y carpeta. |
| **Facturas** | Borradores editables (vencimiento, forma de pago, conceptos, IVA, IRPF), emisión con numeración correlativa `SERIE-AÑO-0001`, plantilla A4 con logo para descargar en PDF, cobros, anulación, duplicar, borradores de cuotas del mes en un clic y exportación CSV para la gestoría. |
| **Informes** | MRR, facturado y cobrado por mes, deuda por antigüedad, ingresos por cliente y por servicio, embudo comercial, carga del equipo, rentabilidad (€/hora) y clientes que necesitan atención. |
| **Actividad** | Registro automático en la base de datos de cada cambio (quién, qué, cuándo). No se puede editar. |
| **Avisos** | En el panel y por email. Cada socio elige en Ajustes: un email por evento, un resumen diario o ninguno. |

### Reglas de facturación

- Una factura se crea como **borrador** y se puede editar libremente.
- Al **emitirla** recibe el siguiente número de su serie y año, se copian los datos fiscales vuestros y del cliente, y queda **bloqueada** (lo impide la propia base de datos).
- No se puede emitir con fecha anterior a la última factura emitida de la serie.
- Una factura emitida no se borra: se **anula** y se emite otra.
- **Verifactu:** a partir del 1 de enero de 2027 (sociedades) o del 1 de julio de 2027 (autónomos) el software que emite facturas debe cumplir Verifactu (registro inalterable, hash encadenado, QR y envío a la AEAT). Antes de esa fecha hay que adaptar este módulo o pasar la emisión a un programa certificado. Consultadlo con vuestra gestoría.

### Avisos que se envían

Al momento: tarea asignada, cliente asignado (como responsable o revisor), documento nuevo en un cliente tuyo.
Cada mañana (cron): tareas que vencen hoy o vencidas, facturas que vencen hoy o vencidas (a los 1, 15 y 30 días), seguimientos comerciales, permanencias que terminan en 30 días y, a primeros de mes, recordatorio de facturar las cuotas. Nunca se repite el mismo aviso.

## Puesta en marcha

### 1. Supabase

1. **SQL Editor** → ejecuta `supabase/migrations/0001_init.sql` (si aún no lo hiciste) y después `supabase/migrations/0002_os.sql`. Se pueden volver a ejecutar sin perder datos.
2. **Authentication → Sign In / Providers → Email:** «Allow new users to sign up» desactivado. Cualquier usuario autenticado ve todo.
3. **Authentication → Users:** un usuario por socio. Al crearse, se crea su perfil automáticamente.
4. **Project Settings → API:** copia `Project URL`, la clave `anon` y la clave `service_role`.
5. Entra en el panel → **Ajustes** y rellena vuestros datos fiscales e IBAN antes de emitir la primera factura.

### 2. Resend (emails)

1. Crea una cuenta en [resend.com](https://resend.com) y verifica vuestro dominio (registros DNS que te indica).
2. Crea una API key.

Sin Resend el panel funciona igual; los avisos solo se ven dentro.

### 3. Local

```bash
cp .env.example .env.local   # y rellena las variables
npm install
npm run dev                  # http://localhost:3000
```

### 4. Vercel

1. *Settings → Environment Variables:* todas las de `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`).
2. *Deploy.* `vercel.json` programa `/api/cron/daily` cada día a las 06:00 UTC (7:00–8:00 en Barcelona).
   Vercel envía `CRON_SECRET` en la cabecera; sin ella la ruta responde 401.
3. Dominio: *Settings → Domains* → `app.dosstudiomkt.com` y en Supabase **Authentication → URL Configuration → Site URL**.

## Seguridad

- Secretos solo en `.env.local` y en las variables de Vercel. `.env*` está en `.gitignore`.
- La clave `anon` es pública por diseño; la protección real es el login + RLS en todas las tablas.
- La clave `service_role` se usa **solo** en el cron (`lib/supabase/admin.ts`), en el servidor. Nunca con prefijo `NEXT_PUBLIC_` ni en un componente de cliente.
- Los documentos están en un bucket privado y se abren con enlaces firmados de 2 minutos.
- Cada socio ve solo sus avisos. El registro de actividad no se puede escribir ni borrar desde la app.
- El repositorio es público: no subáis datos de clientes ni secretos. Mejor pasarlo a privado en GitHub.

## Datos de prueba

Las empresas de prueba llevan `is_demo = true`. Para borrarlas:

```sql
delete from public.companies where is_demo;
```
