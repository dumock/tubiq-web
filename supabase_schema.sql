-- user_settings 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- RLS 활성화
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 사용자가 본인의 설정만 읽을 수 있도록 정책 추가
CREATE POLICY "Users can view their own settings"
ON public.user_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 사용자가 본인의 설정만 추가/수정할 수 있도록 정책 추가
CREATE POLICY "Users can insert their own settings"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거 (선택사항)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
