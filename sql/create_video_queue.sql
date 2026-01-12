-- Create video_queue table for Local Worker Architecture

create table if not exists video_queue (
  id uuid default gen_random_uuid() primary key,
  image_path text not null, -- Local path or Supabase URL
  prompt text not null,
  status text default 'pending', -- pending, processing, completed, failed
  video_path text, -- Local path of result
  video_url text, -- Supabase URL of result
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Enable RLS (Optional, depending on user setup, but good practice)
alter table video_queue enable row level security;

create policy "Enable read access for all users" on video_queue for select using (true);
create policy "Enable insert access for all users" on video_queue for insert with check (true);
create policy "Enable update access for all users" on video_queue for update using (true);

-- Create index for faster polling
create index if not exists idx_video_queue_status on video_queue(status);
