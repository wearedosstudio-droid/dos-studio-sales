-- Dos Studio OS — V2
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0001_init.sql. Se puede ejecutar más de una vez.
--
-- Añade: perfiles del equipo, ajustes fiscales, clientes, tareas, documentos (Storage),
-- facturas con numeración correlativa, horas, notificaciones y registro de actividad.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- PERFILES (uno por usuario de Supabase Auth)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  -- Cómo quiere recibir avisos por email: uno por evento, un resumen diario o ninguno.
  email_mode  text not null default 'evento' check (email_mode in ('evento', 'resumen', 'ninguno')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles de los usuarios que ya existen.
insert into public.profiles (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- AJUSTES (una sola fila): datos fiscales y condiciones por defecto
-- ─────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                     int primary key default 1 check (id = 1),
  legal_name             text,
  trade_name             text default 'Dos Studio',
  nif                    text,
  address                text,
  postal_code            text,
  city                   text,
  province               text,
  country                text default 'España',
  email                  text,
  phone                  text,
  website                text,
  iban                   text,
  invoice_series         text not null default 'DS' check (invoice_series ~ '^[A-Z0-9]{1,6}$'),
  default_vat_rate       numeric(5, 2) not null default 21 check (default_vat_rate between 0 and 100),
  default_irpf_rate      numeric(5, 2) not null default 0 check (default_irpf_rate between 0 and 100),
  default_payment_days   int not null default 15 check (default_payment_days between 0 and 365),
  default_payment_method text not null default 'transferencia',
  invoice_footer         text,
  updated_at             timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies (id) on delete set null,
  name            text not null check (char_length(name) between 1 and 200),

  -- Datos de facturación
  legal_name      text,
  nif             text,
  address         text,
  postal_code     text,
  city            text,
  province        text,
  country         text default 'España',
  billing_email   text,

  -- Contacto que aprueba
  contact_name    text,
  contact_email   text,
  contact_phone   text,

  -- Servicio y operación
  service         text,
  phase           text not null default 'onboarding'
                  check (phase in ('onboarding', 'produccion', 'retencion', 'pausado', 'cerrado')),
  owner_id        uuid references public.profiles (id) on delete set null,
  reviewer_id     uuid references public.profiles (id) on delete set null,
  start_date      date not null default current_date,
  monthly_fee     numeric(12, 2) check (monthly_fee is null or monthly_fee >= 0),
  min_months      int check (min_months is null or min_months between 1 and 60),
  payment_method  text,
  payment_days    int check (payment_days is null or payment_days between 0 and 365),
  notes           text,

  is_demo         boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists clients_phase_idx on public.clients (phase);
create index if not exists clients_owner_idx on public.clients (owner_id);

-- ─────────────────────────────────────────────────────────────
-- TAREAS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  description   text,
  kind          text not null default 'manual' check (kind in ('onboarding', 'mensual', 'manual', 'interna')),
  group_label   text,
  period        text check (period is null or period ~ '^\d{4}-\d{2}$'),
  due_date      date not null,
  assignee_id   uuid references public.profiles (id) on delete set null,
  status        text not null default 'pendiente' check (status in ('pendiente', 'hecha')),
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null,
  sort          int not null default 0,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_open_idx     on public.tasks (status, due_date);
create index if not exists tasks_client_idx   on public.tasks (client_id);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTOS (archivos en Storage o enlaces)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  folder        text not null check (folder in ('contrato', 'onboarding', 'marca', 'contenido', 'informes', 'otros')),
  name          text not null check (char_length(name) between 1 and 300),
  kind          text not null check (kind in ('archivo', 'enlace')),
  storage_path  text,
  url           text,
  mime          text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check ((kind = 'archivo' and storage_path is not null) or (kind = 'enlace' and url is not null))
);
create index if not exists documents_client_idx on public.documents (client_id, created_at desc);

-- Bucket privado. Solo el equipo autenticado lee y escribe.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "documents: equipo autenticado" on storage.objects;
create policy "documents: equipo autenticado"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

-- ─────────────────────────────────────────────────────────────
-- FACTURAS
-- Borrador → Emitida (recibe número correlativo y queda bloqueada) → Cobrada.
-- Una factura emitida no se borra ni se edita: se anula y se hace otra.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.invoice_counters (
  series  text not null,
  year    int  not null,
  last    int  not null default 0,
  primary key (series, year)
);

create table if not exists public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  status             text not null default 'borrador' check (status in ('borrador', 'emitida', 'cobrada', 'anulada')),

  -- Numeración (se asigna al emitir)
  series             text,
  year               int,
  seq                int,
  number             text unique,

  issue_date         date not null default current_date,
  due_date           date not null,
  payment_method     text not null default 'transferencia',
  payment_note       text,
  period             text check (period is null or period ~ '^\d{4}-\d{2}$'),
  notes              text,
  source             text not null default 'manual' check (source in ('manual', 'cuota')),

  -- Copia de los datos del cliente y del emisor en el momento de emitir
  client_name        text,
  client_legal_name  text,
  client_nif         text,
  client_address     text,
  issuer             jsonb,

  vat_rate           numeric(5, 2) not null default 21 check (vat_rate between 0 and 100),
  irpf_rate          numeric(5, 2) not null default 0 check (irpf_rate between 0 and 100),
  subtotal           numeric(12, 2) not null default 0,
  vat_amount         numeric(12, 2) not null default 0,
  irpf_amount        numeric(12, 2) not null default 0,
  total              numeric(12, 2) not null default 0,

  paid_at            date,
  paid_amount        numeric(12, 2),

  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (due_date >= issue_date)
);
create index if not exists invoices_status_idx on public.invoices (status, due_date);
create index if not exists invoices_client_idx on public.invoices (client_id);
-- Una sola factura de cuota por cliente y mes.
create unique index if not exists invoices_cuota_unique
  on public.invoices (client_id, period) where source = 'cuota' and status <> 'anulada';

create table if not exists public.invoice_lines (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  description  text not null check (char_length(description) between 1 and 500),
  quantity     numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price   numeric(12, 2) not null default 0,
  amount       numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort         int not null default 0
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort);

-- Totales: el subtotal sale de las líneas; IVA, IRPF y total se recalculan en cada cambio.
create or replace function public.invoice_compute_totals()
returns trigger
language plpgsql
as $$
begin
  new.vat_amount  := round(new.subtotal * new.vat_rate / 100, 2);
  new.irpf_amount := round(new.subtotal * new.irpf_rate / 100, 2);
  new.total       := new.subtotal + new.vat_amount - new.irpf_amount;
  return new;
end;
$$;

-- Una factura emitida queda bloqueada: solo cambian el estado (cobrada / anulada) y el cobro.
create or replace function public.invoice_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'borrador' then
      raise exception 'Una factura emitida no se puede borrar. Anúlala.';
    end if;
    return old;
  end if;

  if old.status <> 'borrador' then
    if new.status = 'borrador' then
      raise exception 'Una factura emitida no puede volver a borrador.';
    end if;
    if old.status = 'anulada' and new.status <> 'anulada' then
      raise exception 'Una factura anulada no se puede reactivar.';
    end if;
    if (new.client_id, new.number, new.issue_date, new.due_date, new.payment_method, new.subtotal,
        new.vat_rate, new.irpf_rate, new.client_name, new.client_nif, new.client_address)
       is distinct from
       (old.client_id, old.number, old.issue_date, old.due_date, old.payment_method, old.subtotal,
        old.vat_rate, old.irpf_rate, old.client_name, old.client_nif, old.client_address) then
      raise exception 'La factura % ya está emitida y no se puede modificar.', old.number;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard
  before update or delete on public.invoices
  for each row execute function public.invoice_guard();

drop trigger if exists invoices_totals on public.invoices;
create trigger invoices_totals
  before insert or update on public.invoices
  for each row execute function public.invoice_compute_totals();

create or replace function public.invoice_lines_sync()
returns trigger
language plpgsql
as $$
declare
  inv_id uuid := coalesce(new.invoice_id, old.invoice_id);
  inv_status text;
begin
  select status into inv_status from public.invoices where id = inv_id;
  -- Si la factura no existe (se está borrando un borrador), no hay nada que recalcular.
  if inv_status is null then
    return coalesce(new, old);
  end if;
  if inv_status <> 'borrador' then
    raise exception 'Las líneas de una factura emitida no se pueden modificar.';
  end if;
  update public.invoices
     set subtotal = coalesce((select sum(amount) from public.invoice_lines where invoice_id = inv_id), 0)
   where id = inv_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_lines_sync on public.invoice_lines;
create trigger invoice_lines_sync
  after insert or update or delete on public.invoice_lines
  for each row execute function public.invoice_lines_sync();

-- Emitir: número correlativo por serie y año, fechas en orden y copia de datos fiscales.
create or replace function public.issue_invoice(inv_id uuid)
returns text
language plpgsql
as $$
declare
  inv   public.invoices;
  cli   public.clients;
  s     public.settings;
  y     int;
  n     int;
  last_date date;
  num   text;
begin
  select * into inv from public.invoices where id = inv_id for update;
  if not found then raise exception 'Factura no encontrada.'; end if;
  if inv.status <> 'borrador' then raise exception 'Esta factura ya está emitida.'; end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv_id) then
    raise exception 'Añade al menos un concepto antes de emitir.';
  end if;

  select * into s from public.settings where id = 1;
  if coalesce(s.legal_name, '') = '' or coalesce(s.nif, '') = '' or coalesce(s.address, '') = '' then
    raise exception 'Completa vuestros datos fiscales (nombre, NIF y dirección) en Ajustes antes de emitir.';
  end if;

  select * into cli from public.clients where id = inv.client_id;
  if coalesce(cli.nif, '') = '' or coalesce(coalesce(cli.legal_name, cli.name), '') = '' or coalesce(cli.address, '') = '' then
    raise exception 'Faltan datos fiscales del cliente (razón social, NIF y dirección).';
  end if;

  y := extract(year from inv.issue_date)::int;

  select max(issue_date) into last_date
    from public.invoices
   where series = s.invoice_series and year = y and status <> 'borrador';
  if last_date is not null and inv.issue_date < last_date then
    raise exception 'La fecha de emisión no puede ser anterior a la de la última factura emitida (%).', to_char(last_date, 'DD/MM/YYYY');
  end if;

  insert into public.invoice_counters (series, year, last)
  values (s.invoice_series, y, 1)
  on conflict (series, year) do update set last = public.invoice_counters.last + 1
  returning last into n;

  num := s.invoice_series || '-' || y || '-' || lpad(n::text, 4, '0');

  update public.invoices
     set status = 'emitida',
         series = s.invoice_series,
         year = y,
         seq = n,
         number = num,
         client_name = cli.name,
         client_legal_name = coalesce(cli.legal_name, cli.name),
         client_nif = cli.nif,
         client_address = concat_ws(E'\n', cli.address, nullif(concat_ws(' ', cli.postal_code, cli.city), ''),
                                    nullif(concat_ws(', ', cli.province, cli.country), '')),
         issuer = to_jsonb(s) - 'id' - 'updated_at'
   where id = inv_id;

  return num;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- HORAS (para saber qué clientes son rentables)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  work_date   date not null default current_date,
  minutes     int not null check (minutes between 1 and 1440),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists time_entries_client_idx on public.time_entries (client_id, work_date desc);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICACIONES (aviso en el panel + email)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  -- Evita avisar dos veces del mismo evento (p. ej. "task-overdue:<id>").
  dedupe_key  text unique,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- REGISTRO DE ACTIVIDAD (automático, no editable)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  entity     text not null,
  entity_id  uuid,
  action     text not null check (action in ('insert', 'update', 'delete')),
  client_id  uuid,
  label      text,
  changes    jsonb
);
create index if not exists activity_at_idx     on public.activity_log (at desc);
create index if not exists activity_client_idx on public.activity_log (client_id, at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     jsonb;
  old_rec jsonb;
  diff    jsonb := '{}'::jsonb;
  k       text;
  cid     uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    for k in select jsonb_object_keys(rec) loop
      if k not in ('updated_at', 'subtotal', 'vat_amount', 'irpf_amount', 'total', 'issuer')
         and rec -> k is distinct from old_rec -> k then
        diff := diff || jsonb_build_object(k, jsonb_build_array(old_rec -> k, rec -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  end if;

  cid := case
           when tg_table_name = 'clients' then (rec ->> 'id')::uuid
           else nullif(rec ->> 'client_id', '')::uuid
         end;

  insert into public.activity_log (actor_id, entity, entity_id, action, client_id, label, changes)
  values (
    auth.uid(),
    tg_table_name,
    nullif(rec ->> 'id', '')::uuid,
    lower(tg_op),
    cid,
    left(coalesce(rec ->> 'name', rec ->> 'title', rec ->> 'number', rec ->> 'note', rec ->> 'body'), 160),
    case when tg_op = 'UPDATE' then diff end
  );

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'notes', 'clients', 'tasks', 'documents', 'invoices', 'time_entries'] loop
    execute format('drop trigger if exists %I_activity on public.%I', t, t);
    execute format('create trigger %I_activity after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t, t);
  end loop;
end $$;

-- updated_at automático
do $$
declare t text;
begin
  foreach t in array array['clients', 'tasks', 'invoices', 'settings'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- SEGURIDAD (RLS): los dos socios ven y editan todo, salvo
-- las notificaciones (cada uno las suyas) y el registro (solo lectura).
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['settings', 'clients', 'tasks', 'documents', 'invoice_counters', 'invoices',
                           'invoice_lines', 'time_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: equipo autenticado" on public.%I', t, t);
    execute format('create policy "%s: equipo autenticado" on public.%I for all to authenticated
                    using (true) with check (true)', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles: equipo lee" on public.profiles;
create policy "profiles: equipo lee" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: cada uno edita el suyo" on public.profiles;
create policy "profiles: cada uno edita el suyo" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon;

alter table public.notifications enable row level security;
drop policy if exists "notifications: ver las propias" on public.notifications;
create policy "notifications: ver las propias" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications: marcar las propias" on public.notifications;
create policy "notifications: marcar las propias" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Un socio puede avisar al otro (p. ej. al asignarle una tarea).
drop policy if exists "notifications: crear" on public.notifications;
create policy "notifications: crear" on public.notifications for insert to authenticated with check (true);
revoke all on public.notifications from anon;

alter table public.activity_log enable row level security;
drop policy if exists "activity: equipo lee" on public.activity_log;
create policy "activity: equipo lee" on public.activity_log for select to authenticated using (true);
revoke all on public.activity_log from anon;
