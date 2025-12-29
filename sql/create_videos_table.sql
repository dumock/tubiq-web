-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    thumbnail_url TEXT,
    view_count BIGINT DEFAULT 0,
    published_at TEXT,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, youtube_video_id)
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own videos"
ON public.videos FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
