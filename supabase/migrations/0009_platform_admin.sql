-- Platform administration: roles, suspension, audit trail, overview queries.
-- All of this is service-role only: no policy or grant lets clients or salon staff touch it.

create type platform_role as enum ('super_admin', 'admin', 'support');

create table platform_admins (
  user_id uuid primary key references profiles(id) on delete cascade,
  role platform_role not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
revoke all on platform_admins from anon, authenticated;

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;
revoke all on admin_audit_log from anon, authenticated;
create index admin_audit_log_created_idx on admin_audit_log (created_at desc);

-- Business lifecycle: pending (never approved) -> active -> suspended (can be reinstated).
-- is_active stays the single switch for "visible and bookable", so existing queries keep working.
alter table tenants
  add column approved_at timestamptz,
  add column suspended_at timestamptz,
  add column suspension_reason text,
  add column suspended_by uuid references profiles(id) on delete set null,
  add constraint tenants_suspended_inactive check (suspended_at is null or is_active = false);
update tenants set approved_at = created_at where is_active and approved_at is null;

-- One row per business with the numbers an operator needs.
create function admin_salon_overview()
returns table (
  id uuid, name text, type tenant_type, area text, is_active boolean, approved_at timestamptz,
  suspended_at timestamptz, suspension_reason text, created_at timestamptz,
  owner_name text, owner_email text, services_count bigint, staff_count bigint,
  bookings_30d bigint, deposits_30d bigint, upcoming_confirmed bigint
) language sql stable security definer set search_path = public, auth as $$
  select t.id, t.name, t.type, t.area, t.is_active, t.approved_at, t.suspended_at, t.suspension_reason, t.created_at,
    (select p.full_name from tenant_members m join profiles p on p.id = m.user_id where m.tenant_id = t.id and m.role = 'owner' limit 1),
    (select u.email::text from tenant_members m join auth.users u on u.id = m.user_id where m.tenant_id = t.id and m.role = 'owner' limit 1),
    (select count(*) from services s where s.tenant_id = t.id and s.is_active),
    (select count(*) from staff f where f.tenant_id = t.id and f.is_active),
    (select count(*) from bookings b where b.tenant_id = t.id and b.status in ('confirmed', 'completed') and b.created_at > now() - interval '30 days'),
    (select coalesce(sum(p.amount_ugx), 0)::bigint from payments p join bookings b on b.id = p.booking_id
       where b.tenant_id = t.id and p.status = 'successful' and p.completed_at > now() - interval '30 days'),
    (select count(*) from bookings b where b.tenant_id = t.id and b.status = 'confirmed' and b.starts_at > now())
  from tenants t order by t.created_at desc;
$$;

create function admin_user_overview(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, full_name text, phone text, email text, created_at timestamptz, last_sign_in_at timestamptz,
  bookings_count bigint, owns_business boolean, platform_role platform_role, total_count bigint
) language sql stable security definer set search_path = public, auth as $$
  select p.id, p.full_name, p.phone, u.email::text, u.created_at, u.last_sign_in_at,
    (select count(*) from bookings b where b.client_id = p.id),
    exists (select 1 from tenant_members m where m.user_id = p.id and m.role = 'owner'),
    (select a.role from platform_admins a where a.user_id = p.id),
    count(*) over ()
  from profiles p join auth.users u on u.id = p.id
  where p_search is null or p_search = ''
     or p.full_name ilike '%' || p_search || '%' or p.phone ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
  order by u.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;

create function admin_platform_stats() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'active_salons',    (select count(*) from tenants where is_active),
    'pending_salons',   (select count(*) from tenants where not is_active and suspended_at is null),
    'suspended_salons', (select count(*) from tenants where suspended_at is not null),
    'users',            (select count(*) from profiles),
    'bookings_30d',     (select count(*) from bookings where status in ('confirmed', 'completed') and created_at > now() - interval '30 days'),
    'deposits_30d',     (select coalesce(sum(amount_ugx), 0) from payments where status = 'successful' and completed_at > now() - interval '30 days'),
    'commission_30d',   (select coalesce(sum(floor(p.amount_ugx * b.commission_bps / 10000.0)), 0)
                           from payments p join bookings b on b.id = p.booking_id
                          where p.status = 'successful' and p.completed_at > now() - interval '30 days'),
    'refunds_due',      (select count(*) from payments where status = 'successful' and failure_reason like 'LATE_PAYMENT%' and refunded_at is null)
  );
$$;

create function admin_find_user_by_email(p_email text) returns uuid
language sql stable security definer set search_path = auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- These read across every tenant and auth.users: only the server (service role) may call them.
revoke execute on function admin_salon_overview() from public, anon, authenticated;
revoke execute on function admin_user_overview(text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_platform_stats() from public, anon, authenticated;
revoke execute on function admin_find_user_by_email(text) from public, anon, authenticated;
grant execute on function admin_salon_overview() to service_role;
grant execute on function admin_user_overview(text, integer, integer) to service_role;
grant execute on function admin_platform_stats() to service_role;
grant execute on function admin_find_user_by_email(text) to service_role;
