-- Payout number changes now require confirmation (password + SMS code). To make that unbypassable, owners
-- lose direct write access: all changes go through the server, which checks the confirmation first.

drop policy payout_owner_all on tenant_payout_details;
create policy payout_owner_select on tenant_payout_details for select
  using (is_tenant_member(tenant_id, array['owner']::member_role[]));
revoke insert, update, delete on tenant_payout_details from authenticated, anon;

-- Pending changes awaiting the SMS code. Service-role only: RLS on, no policies, no grants.
create table payout_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  provider payment_provider not null,
  phone text not null check (phone ~ '^\+256(70|71|72|74|75|76|77|78|79)\d{7}$'),
  account_name text not null check (char_length(account_name) between 2 and 80),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table payout_change_requests enable row level security;
revoke all on payout_change_requests from anon, authenticated;
create index payout_change_requests_tenant_idx on payout_change_requests (tenant_id, created_at desc);
