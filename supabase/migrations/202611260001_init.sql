create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  passenger_name text not null,
  company text,
  secretary text,
  destination text not null,
  country text,
  departure_date date not null,
  return_date date not null,
  airline text,
  notes text,
  stage text not null default 'new' check (stage in ('new','preparation','checkin','ready','traveling','completed')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_dates_valid check (return_date >= departure_date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  title text not null,
  description text,
  category text,
  due_date date,
  due_time time,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('not_started','pending','in_progress','completed','overdue')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete restrict,
  file_name text not null,
  storage_path text not null unique,
  category text not null default 'outros',
  description text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now(),
  constraint document_parent_required check (trip_id is not null or task_id is not null)
);

create table if not exists public.trip_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists trips_owner_stage_departure_idx on public.trips(owner_id, stage, departure_date);
create index if not exists tasks_owner_due_idx on public.tasks(owner_id, due_date, due_time, status);
create index if not exists documents_trip_idx on public.documents(owner_id, trip_id, created_at desc);
create index if not exists events_trip_idx on public.trip_events(owner_id, trip_id, created_at desc);

alter table public.trips enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.trip_events enable row level security;

create policy "Users manage their own trips" on public.trips for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users manage their own tasks" on public.tasks for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users read their own documents" on public.documents for select to authenticated using (owner_id = (select auth.uid()));
create policy "Users add their own documents" on public.documents for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Users read their own trip history" on public.trip_events for select to authenticated using (owner_id = (select auth.uid()));
create policy "Users add trip history" on public.trip_events for insert to authenticated with check (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-documents', 'trip-documents', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their own private trip files" on storage.objects for select to authenticated using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload to their own private trip folder" on storage.objects for insert to authenticated with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own private trip files" on storage.objects for delete to authenticated using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Keep an append-only audit record when trip status changes.
create or replace function public.record_trip_stage_change()
returns trigger language plpgsql security invoker as $$
begin
  if old.stage is distinct from new.stage then
    insert into public.trip_events (owner_id, trip_id, event_type, title, description)
    values (new.owner_id, new.id, 'stage_changed', 'Etapa da viagem alterada', old.stage || ' → ' || new.stage);
  end if;
  return new;
end;
$$;

drop trigger if exists trips_stage_change_history on public.trips;
create trigger trips_stage_change_history after update of stage on public.trips for each row execute function public.record_trip_stage_change();
