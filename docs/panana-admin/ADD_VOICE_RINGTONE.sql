-- 전화 걸기 시 재생할 링 MP3 URL (어드민에서 업로드)
ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS ringtone_url TEXT;

COMMENT ON COLUMN public.panana_voice_config.ringtone_url IS '전화 링 소리 MP3 공개 URL (Supabase Storage 등)';

-- 링톤은 기존 Storage 버킷 panana-characters 의 voice/ringtone.mp3 경로에 업로드됩니다.
