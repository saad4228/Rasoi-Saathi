-- Public bucket for dish photos. Uploads are limited to images up to 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload their menu images" on storage.objects;
drop policy if exists "Users can update their menu images" on storage.objects;
drop policy if exists "Users can delete their menu images" on storage.objects;

-- Each user may only write inside a folder named after their own user id.
create policy "Authenticated users can upload their menu images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their menu images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-images'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'menu-images'
  and owner_id = (select auth.uid()::text)
);

create policy "Users can delete their menu images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and owner_id = (select auth.uid()::text)
);
