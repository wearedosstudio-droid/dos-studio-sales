-- Dos Studio Sales — esquema inicial (V1.1)
-- Ejecutar en Supabase → SQL Editor.
-- Tablas: companies (empresas/leads) y notes (notas de cada empresa).
-- Auditorías, contactos y actividad llegan en V1.2.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- EMPRESAS / LEADS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),

  -- Información básica
  name                text not null check (char_length(name) between 1 and 200),
  sector              text,
  city                text,
  website             text,
  instagram           text,
  linkedin            text,
  phone               text,
  email               text,

  -- Información comercial
  contact_name        text,
  contact_role        text,
  recommended_service text,
  problem             text,
  opportunity         text,
  priority            text not null default 'media'
                      check (priority in ('alta', 'media', 'baja')),
  potential_value     numeric(12, 2) check (potential_value is null or potential_value >= 0),

  -- Pipeline y seguimiento
  status              text not null default 'nuevo'
                      check (status in (
                        'nuevo', 'auditado', 'contactado', 'respondio', 'reunion',
                        'propuesta', 'negociacion', 'ganado', 'perdido', 'pausado'
                      )),
  last_contact_at     date,
  next_follow_up_at   date,
  follow_up_note      text,

  -- Datos ficticios de desarrollo (nunca presentarlos como reales)
  is_demo             boolean not null default false,

  created_by          uuid references auth.users (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists companies_status_idx    on public.companies (status);
create index if not exists companies_follow_up_idx on public.companies (next_follow_up_at);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- NOTAS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 5000),
  author_id    uuid references auth.users (id) on delete set null default auth.uid(),
  author_email text default (auth.jwt() ->> 'email'),
  created_at   timestamptz not null default now()
);

create index if not exists notes_company_idx on public.notes (company_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- SEGURIDAD (RLS)
-- Solo usuarios autenticados acceden. Ambos socios ven y editan todo.
-- IMPORTANTE: desactiva el registro público en Supabase
-- (Authentication → Sign In / Providers → "Allow new users to sign up" = OFF)
-- y crea los usuarios por invitación. Así solo los socios pueden autenticarse.
-- ─────────────────────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.notes     enable row level security;

drop policy if exists "companies: equipo autenticado" on public.companies;
create policy "companies: equipo autenticado"
  on public.companies for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "notes: equipo autenticado" on public.notes;
create policy "notes: equipo autenticado"
  on public.notes for all
  to authenticated
  using (true)
  with check (true);

-- El rol anónimo no tiene ningún acceso.
revoke all on public.companies from anon;
revoke all on public.notes     from anon;
