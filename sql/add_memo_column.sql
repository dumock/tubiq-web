-- Run this in Supabase SQL Editor to add memo column

-- 1. Add memo to relay_videos table
ALTER TABLE public.relay_videos ADD COLUMN IF NOT EXISTS memo TEXT;

-- 2. Add memo to videos table
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS memo TEXT;
