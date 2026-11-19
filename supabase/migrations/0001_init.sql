-- MobileGlam core schema. All money is whole UGX (bigint). All timestamps timestamptz (UTC).
create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create extension if not exists postgis;

create type tenant_type as enum ('salon', 'barbershop', 'clinic');
create type member_role as enum ('owner', 'manager', 'staff');
create type booking_status as enum ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired');
create type payment_provider as enum ('mtn_momo', 'airtel_money');
create type payment_status as enum ('pending', 'successful', 'failed', 'timeout');

-- Profiles mirror auth.users (phone is the primary identity in Uganda).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique check (phone ~ '^\+256(70|71|72|74|75|76|77|78|79)\d{7}$'),
  created_at timestamptz not null default now()
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  type tenant_type not null,
  description text,
  address text,
  area text,                                  -- e.g. Kololo, Entebbe, Ntinda
  location geography(Point, 4326),
  offers_home_visits boolean not null default false,
  commission_bps integer not null default 1000 check (commission_bps between 0 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index tenants_location_idx on tenants using gist (location);

create table tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null,
  primary key (tenant_id, user_id)
);

-- A bookable stylist / barber / doctor. user_id is optional (staff may not log in).
create table staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  display_name text not null,
  title text,                                 -- "Senior Stylist", "Trichologist"
  is_active boolean not null default true,
  unique (id, tenant_id)
);
create index staff_tenant_idx on staff (tenant_id);

create table services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  price_ugx bigint not null check (price_ugx >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  deposit_percent integer not null default 20 check (deposit_percent between 0 and 100),
  allows_home_visit boolean not null default false,
  is_active boolean not null default true,
  unique (id, tenant_id)
);
create index services_tenant_idx on services (tenant_id);

create table staff_services (
  staff_id uuid not null references staff(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Recurring weekly shifts, in the tenant's local time (Africa/Kampala).
create table staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  -- Postgres has no built-in timerange; map times onto a fixed dummy date to forbid overlapping shifts.
  exclude using gist (
    staff_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time) with &&
  )
);

create table staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  period tstzrange not null,
  reason text
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete restrict,
  staff_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'pending_payment',
  is_home_visit boolean not null default false,
  address text,
  location geography(Point, 4326),
  notes text,
  price_ugx bigint not null check (price_ugx >= 0),
  deposit_ugx bigint not null check (deposit_ugx >= 0 and deposit_ugx <= price_ugx),
  commission_bps integer not null,            -- snapshot at booking time
  hold_expires_at timestamptz,                -- slot hold while awaiting mobile money approval
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at),
  foreign key (staff_id, tenant_id) references staff (id, tenant_id),
  foreign key (service_id, tenant_id) references services (id, tenant_id),
  -- Hard guarantee against double-booking, even under concurrent requests.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending_payment', 'confirmed'))
);
create index bookings_tenant_time_idx on bookings (tenant_id, starts_at);
create index bookings_client_idx on bookings (client_id, starts_at desc);
create index bookings_reminder_idx on bookings (starts_at) where status = 'confirmed' and reminder_sent_at is null;

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete restrict,
  provider payment_provider not null,
  status payment_status not null default 'pending',
  amount_ugx bigint not null check (amount_ugx > 0),
  payer_phone text not null,
  reference_id uuid not null unique default gen_random_uuid(),  -- our idempotency key (MTN X-Reference-Id / Airtel transaction.id)
  provider_txn_id text,
  failure_reason text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index payments_booking_idx on payments (booking_id);
create index payments_pending_idx on payments (created_at) where status = 'pending';

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note text not null check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index client_notes_idx on client_notes (tenant_id, client_id, created_at desc);

-- Auto-create a profile when a user signs up (phone OTP or email).
-- Supabase stores phone without '+'; normalise to E.164.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare p text := nullif(new.phone, '');
begin
  if p is not null and left(p, 1) <> '+' then p := '+' || p; end if;
  insert into profiles (id, phone, full_name)
  values (new.id, p, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
