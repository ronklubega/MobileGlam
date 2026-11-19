-- Onboarding hardening + payout details.

-- SECURITY FIX: the earlier tenants_manage policy let a manager UPDATE any column, including is_active
-- (bypassing platform approval) and slug. Restrict column-level update rights to the safe business-profile fields.
revoke update on tenants from authenticated, anon;
grant update (name, description, address, area, offers_home_visits) on tenants to authenticated;

-- Where each business receives its deposit payouts. Visible and editable by the OWNER only,
-- never public (kept out of `tenants`, whose rows are world-readable for the catalogue).
create table tenant_payout_details (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  provider payment_provider not null,
  phone text not null check (phone ~ '^\+256(70|71|72|74|75|76|77|78|79)\d{7}$'),
  account_name text not null check (char_length(account_name) between 2 and 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
alter table tenant_payout_details enable row level security;
create policy payout_owner_all on tenant_payout_details for all
  using (is_tenant_member(tenant_id, array['owner']::member_role[]))
  with check (is_tenant_member(tenant_id, array['owner']::member_role[]));
