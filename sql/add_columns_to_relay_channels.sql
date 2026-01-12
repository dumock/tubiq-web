-- Run this in Supabase SQL Editor to prepare relay_channels table

-- 1. Create the table if it doesn't exist (with minimal PK)
CREATE TABLE IF NOT EXISTS public.relay_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at BIGINT -- We use BIGINT for timestamp ms matching python code
);

-- 2. Add all potential missing columns
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.relay_channels ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 3. Add Unique Constraint for Upsert (ON CONFLICT)
-- The python code uses: account_id,platform,external_id
-- We need a unique index on these 3 columns.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relay_channels_account_platform_external_key') THEN
        ALTER TABLE public.relay_channels 
        ADD CONSTRAINT relay_channels_account_platform_external_key 
        UNIQUE (account_id, platform, external_id);
    END IF;
END $$;

-- 4. Enable RLS (Security) - Optional but recommended
ALTER TABLE public.relay_channels ENABLE ROW LEVEL SECURITY;

-- 5. Open access (or restrict as needed) - For relay, we might need service role or public insert
CREATE POLICY "Enable read/write for all users" ON "public"."relay_channels"
AS PERMISSIVE FOR ALL
TO public
USING (true)
WITH CHECK (true);
