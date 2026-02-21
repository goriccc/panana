-- Grok 음성대화 설정 (xAI Grok Voice Agent, admin/voice에서 사용)
-- reunionf82 Voice MVP 구조 참고, grok-voice-1 등 xAI Voice Agent 연동용 플래그·모델명

ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS groq_voice_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS groq_model TEXT;

COMMENT ON COLUMN public.panana_voice_config.groq_voice_enabled IS 'Grok(xAI) 음성대화 사용 여부 (API 키는 환경변수 XAI_API_KEY)';
COMMENT ON COLUMN public.panana_voice_config.groq_model IS 'Grok Voice 모델 (예: grok-voice-1)';
