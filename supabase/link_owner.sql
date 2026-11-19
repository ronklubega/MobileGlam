-- Gives a dashboard login access to a salon. Run in the Supabase SQL editor.
-- 1) Create the user first: Authentication -> Users -> Add user (email + password, tick "Auto Confirm User").
-- 2) Replace the email below, then run. Seeded salon ids: ...0001 Kololo, ...0002 Ntinda, ...0003 Muyenga clinic, ...0004 Entebbe.

insert into tenant_members (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from auth.users u
cross join (values
  ('a0000000-0000-0000-0000-000000000001'::uuid),
  ('a0000000-0000-0000-0000-000000000002'::uuid)
) as t(id)
where u.email = 'lubegaronald@gmail.com'
on conflict do nothing;
