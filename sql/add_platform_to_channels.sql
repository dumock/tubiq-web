-- Add platform column to channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'youtube';

-- Create index for faster querying by platform
CREATE INDEX IF NOT EXISTS channels_platform_idx ON public.channels (platform);

-- Comment: Supported platforms are 'youtube', 'tiktok', 'douyin'
