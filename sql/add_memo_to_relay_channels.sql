-- Run this in Supabase SQL Editor

-- Add memo column to relay_channels table
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS memo TEXT;

-- (Optional) Add unique constraint if not already present for the worker's logic
-- ALTER TABLE public.relay_channels ADD CONSTRAINT relay_channels_unique_entry UNIQUE (account_id, external_id);
