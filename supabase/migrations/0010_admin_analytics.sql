-- Platform analytics for the operator overview: trends, growth, mix and leaders over a rolling window,
-- plus the same totals for the previous window so the dashboard can show change.
-- Days are Kampala calendar days. Revenue = successful mobile-money deposits (same definition as admin_platform_stats).
-- Service-role only, like the other admin_* functions.

create or replace function admin_platform_analytics(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  d_to   date := (now() at time zone 'Africa/Kampala')::date;
  d_from date := d_to - (greatest(1, least(p_days, 366)) - 1);
  n      integer := d_to - d_from + 1;
  p_from date := d_from - n;  -- previous window: [p_from, d_from - 1]
begin
  return (
    with pay as (
      select (p.completed_at at time zone 'Africa/Kampala')::date as day, p.amount_ugx, p.provider,
             floor(p.amount_ugx * b.commission_bps / 10000.0)::bigint as commission,
             b.id as booking_id, b.tenant_id, b.client_id
        from payments p join bookings b on b.id = p.booking_id
       where p.status = 'successful' and p.completed_at is not null
    ),
    cur as (select * from pay where day between d_from and d_to),
    prev as (select * from pay where day between p_from and d_from - 1),
    users_by_day as (
      select (created_at at time zone 'Africa/Kampala')::date as day, count(*) as c from profiles group by 1
    ),
    biz_by_day as (
      select (created_at at time zone 'Africa/Kampala')::date as day, count(*) as c from tenants group by 1
    ),
    series as (
      select d::date as day,
             coalesce((select sum(amount_ugx) from cur where cur.day = d::date), 0)::bigint as deposits,
             coalesce((select sum(commission) from cur where cur.day = d::date), 0)::bigint as commission,
             (select count(distinct booking_id) from cur where cur.day = d::date) as bookings,
             coalesce((select c from users_by_day u where u.day = d::date), 0) as new_users,
             coalesce((select c from biz_by_day t where t.day = d::date), 0) as new_businesses
        from generate_series(d_from, d_to, interval '1 day') d
    )
    select jsonb_build_object(
      'from', d_from, 'to', d_to, 'days', n,
      'series', (select coalesce(jsonb_agg(to_jsonb(s) order by s.day), '[]') from series s),
      'totals', jsonb_build_object(
        'deposits',       (select coalesce(sum(amount_ugx), 0) from cur),
        'commission',     (select coalesce(sum(commission), 0) from cur),
        'bookings',       (select count(distinct booking_id) from cur),
        'clients',        (select count(distinct client_id) from cur),
        'returning',      (select count(distinct c.client_id) from cur c
                            where exists (select 1 from pay x where x.client_id = c.client_id and x.day < d_from)),
        'paying_businesses', (select count(distinct tenant_id) from cur),
        'new_users',      (select count(*) from profiles where (created_at at time zone 'Africa/Kampala')::date between d_from and d_to),
        'new_businesses', (select count(*) from tenants  where (created_at at time zone 'Africa/Kampala')::date between d_from and d_to)
      ),
      'previous', jsonb_build_object(
        'deposits',       (select coalesce(sum(amount_ugx), 0) from prev),
        'commission',     (select coalesce(sum(commission), 0) from prev),
        'bookings',       (select count(distinct booking_id) from prev),
        'clients',        (select count(distinct client_id) from prev),
        'new_users',      (select count(*) from profiles where (created_at at time zone 'Africa/Kampala')::date between p_from and d_from - 1),
        'new_businesses', (select count(*) from tenants  where (created_at at time zone 'Africa/Kampala')::date between p_from and d_from - 1)
      ),
      -- running totals start from everything that existed before the window
      'users_before',      (select count(*) from profiles where (created_at at time zone 'Africa/Kampala')::date < d_from),
      'businesses_before', (select count(*) from tenants  where (created_at at time zone 'Africa/Kampala')::date < d_from),
      'business_mix', (
        select coalesce(jsonb_agg(jsonb_build_object('type', type, 'active', active, 'pending', pending, 'suspended', suspended) order by type), '[]')
          from (select type,
                       count(*) filter (where is_active) as active,
                       count(*) filter (where not is_active and suspended_at is null) as pending,
                       count(*) filter (where suspended_at is not null) as suspended
                  from tenants group by type) t
      ),
      'top_businesses', (
        select coalesce(jsonb_agg(x order by x.deposits desc), '[]') from (
          select t.id, t.name, t.type, t.area, sum(c.amount_ugx)::bigint as deposits, count(distinct c.booking_id) as bookings
            from cur c join tenants t on t.id = c.tenant_id
           group by t.id order by deposits desc limit 8
        ) x
      ),
      'by_area', (
        select coalesce(jsonb_agg(x order by x.deposits desc), '[]') from (
          select coalesce(nullif(trim(t.area), ''), 'Not set') as area, sum(c.amount_ugx)::bigint as deposits, count(distinct c.booking_id) as bookings
            from cur c join tenants t on t.id = c.tenant_id
           group by 1 order by deposits desc
        ) x
      ),
      'by_provider', (
        select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'deposits', deposits, 'count', cnt)), '[]')
          from (select provider, sum(amount_ugx)::bigint as deposits, count(*) as cnt from cur group by provider) x
      ),
      'booking_outcomes', (
        select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]')
          from (select status, count(*) as cnt from bookings
                 where (created_at at time zone 'Africa/Kampala')::date between d_from and d_to group by status) x
      )
    )
  );
end $$;

revoke execute on function admin_platform_analytics(integer) from public, anon, authenticated;
grant execute on function admin_platform_analytics(integer) to service_role;
