-- Dashboard support: refund tracking and atomic shift replacement.

alter table payments
  add column refunded_at timestamptz,
  add column refund_reference text;
create index payments_refund_queue_idx on payments (created_at)
  where status = 'successful' and failure_reason like 'LATE_PAYMENT%' and refunded_at is null;

-- Replaces a staff member's whole weekly schedule in one transaction.
-- SECURITY INVOKER: the caller's RLS policies decide whether they may edit this staff member.
create function replace_staff_shifts(p_staff uuid, p_shifts jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from staff_shifts where staff_id = p_staff;
  insert into staff_shifts (staff_id, weekday, start_time, end_time)
  select p_staff, (s ->> 'weekday')::smallint, (s ->> 'start')::time, (s ->> 'end')::time
  from jsonb_array_elements(p_shifts) s;
end $$;
grant execute on function replace_staff_shifts(uuid, jsonb) to authenticated;

-- Clients of a tenant with visit counts, for the Clients page.
create function tenant_clients(p_tenant uuid)
returns table (client_id uuid, full_name text, phone text, visits bigint, last_visit timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.phone,
         count(*) filter (where b.status in ('confirmed', 'completed')),
         max(b.starts_at) filter (where b.status in ('confirmed', 'completed'))
  from bookings b join profiles p on p.id = b.client_id
  where b.tenant_id = p_tenant and is_tenant_member(p_tenant)
  group by p.id order by max(b.starts_at) desc nulls last;
$$;
grant execute on function tenant_clients(uuid) to authenticated;
