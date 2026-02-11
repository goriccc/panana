-- panana 음성 설정 테이블 (vertex-live-proxy 연동용)
-- reunionf82 voice_mvp_config 구조 참고, panana는 캐릭터 채팅용 단일 설정

CREATE TABLE IF NOT EXISTS public.panana_voice_config (
  id SERIAL PRIMARY KEY,
  voice_gender TEXT NOT NULL DEFAULT 'female' CHECK (voice_gender IN ('female', 'male')),
  voice_style TEXT NOT NULL DEFAULT 'calm' CHECK (voice_style IN ('calm', 'bright', 'firm', 'empathetic', 'warm')),
  voice_name_female TEXT NOT NULL DEFAULT 'Aoede',
  voice_name_male TEXT NOT NULL DEFAULT 'Fenrir',
  base_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.panana_voice_config IS '음성 채팅용 전역 설정 (성별/말투/보이스명)';
COMMENT ON COLUMN public.panana_voice_config.voice_gender IS '음성 성별: female | male';
COMMENT ON COLUMN public.panana_voice_config.voice_style IS '말투/성향: calm, bright, firm, empathetic, warm';
COMMENT ON COLUMN public.panana_voice_config.voice_name_female IS '여성 보이스: Aoede, Kore, Charon 등';
COMMENT ON COLUMN public.panana_voice_config.voice_name_male IS '남성 보이스: Fenrir, Puck 등';
COMMENT ON COLUMN public.panana_voice_config.base_model IS 'Gemini Live 모델 (예: gemini-2.5-flash-native-audio-preview-12-2025)';

-- RLS
ALTER TABLE public.panana_voice_config ENABLE ROW LEVEL SECURITY;

-- 읽기: anon (채팅 화면에서 voice config 조회 시)
CREATE POLICY "panana_voice_config_read_anon"
  ON public.panana_voice_config FOR SELECT
  USING (true);

-- 쓰기: admin만 (service_role 또는 admin 체크는 앱 레벨)
CREATE POLICY "panana_voice_config_admin_all"
  ON public.panana_voice_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.panana_admin_users a
      WHERE a.user_id = auth.uid() AND a.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.panana_admin_users a
      WHERE a.user_id = auth.uid() AND a.active = true
    )
  );

-- 초기 행 삽입 (단일 설정, 없을 때만)
INSERT INTO public.panana_voice_config (voice_gender, voice_style, voice_name_female, voice_name_male, base_model, updated_at)
SELECT 'female', 'warm', 'Aoede', 'Fenrir', 'gemini-2.5-flash-native-audio-preview-12-2025', now()
WHERE NOT EXISTS (SELECT 1 FROM public.panana_voice_config LIMIT 1);
