-- Grok 전용 음성 선택·Temperature (admin 음성대화 모델 라디오와 별도 섹션용)

ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS groq_voice TEXT;

ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS groq_temperature NUMERIC(3,2);

COMMENT ON COLUMN public.panana_voice_config.groq_voice IS 'Grok 전용 음성: Ara, Rex, Sal, Eve, Leo';
COMMENT ON COLUMN public.panana_voice_config.groq_temperature IS 'Grok 음성 대화 Temperature (0~2, 예: 0.7)';

ALTER TABLE public.panana_voice_config
  ADD COLUMN IF NOT EXISTS groq_natural_korean BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.panana_voice_config.groq_natural_korean IS 'Grok 음성: 한국어 자연 발음 강화 (Gemini처럼 또렷하게 말하기)';
