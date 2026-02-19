-- 전화 끊기 시 재생할 MP3 URL (어드민에서 업로드)
ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS hangup_sound_url TEXT;

COMMENT ON COLUMN public.panana_voice_config.hangup_sound_url IS '전화 끊기 소리 MP3 공개 URL (Supabase Storage 등)';

-- 끊기 효과음은 Storage 버킷 panana-characters 의 voice/hangup.mp3 경로에 업로드됩니다.
