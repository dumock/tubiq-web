-- Create image_queue table for Local Worker Architecture
create table if not exists image_queue (
  id uuid default gen_random_uuid() primary key,
  prompt text not null,
  status text default 'pending', -- pending, processing, completed, failed
  image_urls text[], -- Array of result Base64 strings or URLs
  selected_image_url text, -- The chosen image
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Enable RLS
alter table image_queue enable row level security;

create policy "Enable read access for all users" on image_queue for select using (true);
create policy "Enable insert access for all users" on image_queue for insert with check (true);
create policy "Enable update access for all users" on image_queue for update using (true);

-- Create index for faster polling
create index if not exists idx_image_queue_status on image_queue(status);
