create table if not exists public.flight_segments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  passenger_name text not null,
  airline text not null,
  flight_number text,
  origin text not null,
  destination text not null,
  departure_at timestamptz not null,
  arrival_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flight_arrival_after_departure check (arrival_at is null or arrival_at >= departure_at)
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  flight_segment_id uuid not null references public.flight_segments(id) on delete restrict,
  available_at timestamptz,
  status text not null default 'pending' check (status in ('not_available','pending','in_progress','completed','unable','not_applicable')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flight_segment_id)
);

create table if not exists public.boarding_passes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  flight_segment_id uuid not null references public.flight_segments(id) on delete restrict,
  status text not null default 'awaiting' check (status in ('awaiting','received','sent')),
  recipient_type text check (recipient_type in ('passenger','secretary')),
  recipient_name text,
  received_at timestamptz,
  sent_at timestamptz,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sent_pass_requires_recipient check (status <> 'sent' or recipient_type is not null)
);

create table if not exists public.hotel_reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  hotel_name text not null,
  city text,
  country text,
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  reservation_number text,
  room_information text,
  confirmation_requested_at timestamptz,
  confirmation_deadline timestamptz,
  confirmed_at timestamptz,
  status text not null default 'not_requested' check (status in ('not_requested','requested','awaiting_confirmation','confirmed','issue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_dates_valid check (check_out > check_in)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trip_id uuid not null references public.trips(id) on delete restrict,
  passenger_name text not null,
  pickup_location text not null,
  destination text not null,
  pickup_at timestamptz not null,
  driver_name text,
  driver_contact text,
  company_name text,
  booking_reference text,
  status text not null default 'pending' check (status in ('pending','requested','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flight_segments_trip_departure_idx on public.flight_segments(owner_id, trip_id, departure_at);
create index if not exists check_ins_schedule_idx on public.check_ins(owner_id, available_at, status);
create index if not exists boarding_passes_status_idx on public.boarding_passes(owner_id, status, created_at desc);
create index if not exists hotel_reservations_status_dates_idx on public.hotel_reservations(owner_id, status, check_in, check_out);
create index if not exists transfers_schedule_idx on public.transfers(owner_id, pickup_at, status);

alter table public.flight_segments enable row level security;
alter table public.check_ins enable row level security;
alter table public.boarding_passes enable row level security;
alter table public.hotel_reservations enable row level security;
alter table public.transfers enable row level security;

create policy "Users manage their own flight segments" on public.flight_segments for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users manage their own check-ins" on public.check_ins for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users manage their own boarding passes" on public.boarding_passes for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users manage their own hotel reservations" on public.hotel_reservations for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Users manage their own transfers" on public.transfers for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Enforce that linked records all belong to the same authenticated owner and trip.
create or replace function public.validate_trip_owner_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.trips t where t.id = new.trip_id and t.owner_id = new.owner_id) then
    raise exception 'Trip must belong to the same owner';
  end if;
  return new;
end;
$$;

create or replace function public.validate_checkin_flight_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.flight_segments f where f.id = new.flight_segment_id and f.trip_id = new.trip_id and f.owner_id = new.owner_id) then
    raise exception 'Flight segment must belong to the same owner and trip';
  end if;
  return new;
end;
$$;

create or replace function public.validate_document_parent_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare parent_trip_id uuid;
begin
  if new.trip_id is not null and not exists (select 1 from public.trips t where t.id = new.trip_id and t.owner_id = new.owner_id) then
    raise exception 'Trip must belong to the same owner';
  end if;
  if new.task_id is not null then
    select task.trip_id into parent_trip_id from public.tasks task where task.id = new.task_id and task.owner_id = new.owner_id;
    if not found then raise exception 'Task must belong to the same owner'; end if;
    if new.trip_id is not null and parent_trip_id is distinct from new.trip_id then
      raise exception 'Task and document must reference the same trip';
    end if;
    if new.trip_id is null then new.trip_id := parent_trip_id; end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_task_trip_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.trip_id is not null and not exists (select 1 from public.trips t where t.id = new.trip_id and t.owner_id = new.owner_id) then
    raise exception 'Trip must belong to the same owner';
  end if;
  return new;
end;
$$;

create trigger flight_segment_owner_check before insert or update of owner_id, trip_id on public.flight_segments for each row execute function public.validate_trip_owner_link();
create trigger checkin_trip_owner_check before insert or update of owner_id, trip_id on public.check_ins for each row execute function public.validate_trip_owner_link();
create trigger checkin_flight_owner_check before insert or update of owner_id, trip_id, flight_segment_id on public.check_ins for each row execute function public.validate_checkin_flight_link();
create trigger boarding_pass_trip_owner_check before insert or update of owner_id, trip_id on public.boarding_passes for each row execute function public.validate_trip_owner_link();
create trigger boarding_pass_flight_owner_check before insert or update of owner_id, trip_id, flight_segment_id on public.boarding_passes for each row execute function public.validate_checkin_flight_link();
create trigger hotel_trip_owner_check before insert or update of owner_id, trip_id on public.hotel_reservations for each row execute function public.validate_trip_owner_link();
create trigger transfer_trip_owner_check before insert or update of owner_id, trip_id on public.transfers for each row execute function public.validate_trip_owner_link();
create trigger task_trip_owner_check before insert or update of owner_id, trip_id on public.tasks for each row execute function public.validate_task_trip_link();
create trigger document_parent_owner_check before insert or update of owner_id, trip_id, task_id on public.documents for each row execute function public.validate_document_parent_link();

revoke all on function public.validate_trip_owner_link() from public, anon, authenticated;
revoke all on function public.validate_checkin_flight_link() from public, anon, authenticated;
revoke all on function public.validate_document_parent_link() from public, anon, authenticated;
revoke all on function public.validate_task_trip_link() from public, anon, authenticated;
