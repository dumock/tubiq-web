-- Enable Realtime for channel-related tables
-- Run this in Supabase SQL Editor

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.relay_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.relay_videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;

-- Verify which tables have realtime enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
