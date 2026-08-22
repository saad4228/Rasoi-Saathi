insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload their menu images" on storage.objects;
drop policy if exists "Users can update their menu images" on storage.objects;

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