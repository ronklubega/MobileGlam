-- Customer profiles: photo + restricted self-edit, with a public avatars bucket.

alter table profiles add column avatar_url text;

-- Users may only change their own name and photo. In particular NOT `phone`: it is the verified identity that
-- salons see, and it must only ever come from the auth provider.
revoke update on profiles from authenticated, anon;
grant update (full_name, avatar_url) on profiles to authenticated;
alter table profiles add constraint profiles_full_name_len check (full_name is null or char_length(full_name) between 2 and 80);

-- Public-read bucket (images load by plain URL, no signed URLs needed on slow networks). 2 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

-- Each user can write only inside their own folder: avatars/<user-id>/<file>
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
