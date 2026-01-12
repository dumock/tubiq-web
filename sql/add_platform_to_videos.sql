-- Add platform and memo columns to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS platform text DEFAULT 'youtube',
ADD COLUMN IF NOT EXISTS memo text;

-- Create index for faster querying by platform
CREATE INDEX IF NOT EXISTS videos_platform_idx ON public.videos (platform);
