-- Create video_files table to track metadata
create table if not exists video_files (
  id uuid default gen_random_uuid() primary key,
  filename text not null,
  storage_path text not null,
  size bigint,
  mime_type text,
  duration float,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table video_files enable row level security;

-- Policy for video_files (Allow all for anon usage for now)
create policy "Enable all access for all users"
  on video_files for all
  using (true)
  with check (true);

-- Storage Policies for 'videos' bucket
-- These policies allow the anon key (client) to perform operations on the 'videos' bucket

create policy "Give anon users access to own folder 1okq8j_0" 
on storage.objects for select 
using ( bucket_id = 'videos' );

create policy "Give anon users access to own folder 1okq8j_1" 
on storage.objects for insert 
with check ( bucket_id = 'videos' );

create policy "Give anon users access to own folder 1okq8j_2" 
on storage.objects for update 
using ( bucket_id = 'videos' );

create policy "Give anon users access to own folder 1okq8j_3" 
on storage.objects for delete 
using ( bucket_id = 'videos' );
