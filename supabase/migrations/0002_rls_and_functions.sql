-- Row-Level Security. Bookings and payments are only ever WRITTEN by the server (service role),
-- which validates availability and talks to MTN/Airtel. Clients get read access to their own rows.

create function is_tenant_member(t uuid, roles member_role[] default array['owner','manager','staff']::member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenant_members where tenant_id = t and user_id = auth.uid() and role = any(roles));
$$;

alter table profiles enable row level security;
alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table staff_services enable row level security;
alter table staff_shifts enable row level security;
alter table staff_time_off enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table client_notes enable row level security;

-- profiles
create policy profiles_self_read on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_tenant_read on profiles for select using (
  exists (select 1 from bookings b where b.client_id = profiles.id and is_tenant_member(b.tenant_id))
);

-- tenants: public catalogue; only owners/managers edit
create policy tenants_public_read on tenants for select using (is_active or is_tenant_member(id));
create policy tenants_manage on tenants for update using (is_tenant_member(id, array['owner','manager']::member_role[]))
  with check (is_tenant_member(id, array['owner','manager']::member_role[]));
-- NOTE: commission_bps must not be editable by tenants; lock it down at column level.
revoke update (commission_bps) on tenants from authenticated, anon;

create policy members_read on tenant_members for select using (user_id = auth.uid() or is_tenant_member(tenant_id));
create policy members_manage on tenant_members for all using (is_tenant_member(tenant_id, array['owner']::member_role[]))
  with check (is_tenant_member(tenant_id, array['owner']::member_role[]));

-- staff / services / shifts: public read of active rows, managers write
create policy staff_read on staff for select using (is_active or is_tenant_member(tenant_id));
create policy staff_write on staff for all using (is_tenant_member(tenant_id, array['owner','manager']::member_role[]))
  with check (is_tenant_member(tenant_id, array['owner','manager']::member_role[]));

create policy services_read on services for select using (is_active or is_tenant_member(tenant_id));
create policy services_write on services for all using (is_tenant_member(tenant_id, array['owner','manager']::member_role[]))
  with check (is_tenant_member(tenant_id, array['owner','manager']::member_role[]));

create policy staff_services_read on staff_services for select using (true);
create policy staff_services_write on staff_services for all
  using (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])))
  with check (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])));

create policy shifts_read on staff_shifts for select using (true);
create policy shifts_write on staff_shifts for all
  using (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])))
  with check (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])));

create policy time_off_read on staff_time_off for select using (true);
create policy time_off_write on staff_time_off for all
  using (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])))
  with check (exists (select 1 from staff s where s.id = staff_id and is_tenant_member(s.tenant_id, array['owner','manager']::member_role[])));

-- bookings: read-only for clients and tenant members; writes go through the server.
create policy bookings_read on bookings for select using (client_id = auth.uid() or is_tenant_member(tenant_id));
create policy bookings_staff_update on bookings for update using (is_tenant_member(tenant_id))
  with check (is_tenant_member(tenant_id));
revoke update on bookings from authenticated, anon;
grant update (status, notes) on bookings to authenticated;  -- staff may mark completed / no_show

-- payments: read-only
create policy payments_read on payments for select using (
  exists (select 1 from bookings b where b.id = booking_id and (b.client_id = auth.uid() or is_tenant_member(b.tenant_id)))
);

-- client notes: internal to the tenant, never visible to the client
create policy notes_read on client_notes for select using (is_tenant_member(tenant_id));
create policy notes_insert on client_notes for insert with check (is_tenant_member(tenant_id) and author_id = auth.uid());

-- Availability without exposing other clients' bookings: returns busy ranges only.
create function get_busy_ranges(p_staff uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz) language sql stable security definer set search_path = public as $$
  select b.starts_at, b.ends_at from bookings b
  where b.staff_id = p_staff and b.status in ('pending_payment', 'confirmed')
    and b.starts_at < p_to and b.ends_at > p_from
  union all
  select lower(period), upper(period) from staff_time_off
  where staff_id = p_staff and period && tstzrange(p_from, p_to);
$$;
grant execute on function get_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Nearby tenants (Kampala/Entebbe search).
create function nearby_tenants(p_lat double precision, p_lng double precision, p_radius_km double precision,
                               p_type tenant_type default null, p_home_visit boolean default null)
returns table (id uuid, name text, slug text, type tenant_type, area text, offers_home_visits boolean, distance_km double precision)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.slug, t.type, t.area, t.offers_home_visits,
         st_distance(t.location, st_makepoint(p_lng, p_lat)::geography) / 1000.0
  from tenants t
  where t.is_active and t.location is not null
    and st_dwithin(t.location, st_makepoint(p_lng, p_lat)::geography, p_radius_km * 1000)
    and (p_type is null or t.type = p_type)
    and (p_home_visit is null or t.offers_home_visits = p_home_visit)
  order by 7 limit 50;
$$;

-- Releases slots whose mobile-money prompt was never approved. Run every minute via pg_cron.
create function expire_stale_holds() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update payments set status = 'timeout', completed_at = now()
   where status = 'pending' and booking_id in (
     select id from bookings where status = 'pending_payment' and hold_expires_at < now());
  update bookings set status = 'expired' where status = 'pending_payment' and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function expire_stale_holds() from public, anon, authenticated;

-- Daily revenue + commission, for the admin dashboard. Only successful deposits count.
create function tenant_daily_revenue(p_tenant uuid, p_from date, p_to date)
returns table (day date, deposits_ugx bigint, commission_ugx bigint, bookings_count bigint)
language sql stable security definer set search_path = public as $$
  select (p.completed_at at time zone 'Africa/Kampala')::date,
         sum(p.amount_ugx)::bigint,
         sum(floor(p.amount_ugx * b.commission_bps / 10000.0))::bigint,
         count(distinct b.id)
  from payments p join bookings b on b.id = p.booking_id
  where b.tenant_id = p_tenant and p.status = 'successful'
    and (p.completed_at at time zone 'Africa/Kampala')::date between p_from and p_to
    and is_tenant_member(p_tenant, array['owner','manager']::member_role[])
  group by 1 order by 1;
$$;
grant execute on function tenant_daily_revenue(uuid, date, date) to authenticated;
