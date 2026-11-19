-- Business photos: up to 10 per tenant, first (lowest position) is the cover shown in Discover.

create table tenant_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  path text not null unique check (path like tenant_id::text || '/%'),   -- storage object path
  url text not null,                                                     -- public URL
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index tenant_photos_tenant_idx on tenant_photos (tenant_id, position);
alter table tenant_photos enable row level security;

create policy tenant_photos_read on tenant_photos for select using (
  exists (select 1 from tenants t where t.id = tenant_photos.tenant_id and t.is_active) or is_tenant_member(tenant_id)
);
create policy tenant_photos_write on tenant_photos for all
  using (is_tenant_member(tenant_id, array['owner','manager']::member_role[]))
  with check (is_tenant_member(tenant_id, array['owner','manager']::member_role[]));

create function enforce_tenant_photo_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from tenant_photos where tenant_id = new.tenant_id) >= 10 then
    raise exception 'A business can have at most 10 photos' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger tenant_photos_limit before insert on tenant_photos for each row execute function enforce_tenant_photo_limit();

-- Storage: public-read bucket, writes only by owners/managers into their own <tenant-id>/ folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-photos', 'tenant-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = excluded.allowed_mime_types;

-- Returns false (instead of raising) when the first folder isn't a valid tenant uuid.
create function can_manage_tenant_photos(p_path text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare t uuid;
begin
  begin
    t := ((storage.foldername(p_path))[1])::uuid;
  exception when others then
    return false;
  end;
  return is_tenant_member(t, array['owner','manager']::member_role[]);
end $$;

create policy tenant_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-photos' and can_manage_tenant_photos(name));
create policy tenant_photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-photos' and can_manage_tenant_photos(name));
create policy tenant_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-photos' and can_manage_tenant_photos(name));

-- Discover now includes each business's cover photo.
drop function nearby_tenants(double precision, double precision, double precision, tenant_type, boolean);
create function nearby_tenants(p_lat double precision, p_lng double precision, p_radius_km double precision,
                               p_type tenant_type default null, p_home_visit boolean default null)
returns table (id uuid, name text, slug text, type tenant_type, area text, offers_home_visits boolean, distance_km double precision, cover_url text)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.slug, t.type, t.area, t.offers_home_visits,
         st_distance(t.location, st_makepoint(p_lng, p_lat)::geography) / 1000.0,
         (select p.url from tenant_photos p where p.tenant_id = t.id order by p.position, p.created_at limit 1)
  from tenants t
  where t.is_active and t.location is not null
    and st_dwithin(t.location, st_makepoint(p_lng, p_lat)::geography, p_radius_km * 1000)
    and (p_type is null or t.type = p_type)
    and (p_home_visit is null or t.offers_home_visits = p_home_visit)
  order by 7 limit 50;
$$;
