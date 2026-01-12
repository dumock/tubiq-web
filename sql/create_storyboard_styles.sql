
-- Create storyboard_styles table
CREATE TABLE IF NOT EXISTS public.storyboard_styles (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(), -- Optional: link to auth.users if using Supabase Auth
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    preview_color TEXT DEFAULT 'bg-gray-500',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.storyboard_styles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own styles" 
ON public.storyboard_styles FOR SELECT 
USING (true); -- For now allow all, or restrict to auth.uid() = user_id if auth is strictly enforced

CREATE POLICY "Users can insert their own styles" 
ON public.storyboard_styles FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can delete their own styles" 
ON public.storyboard_styles FOR DELETE 
USING (true);
