-- Migration: 음성 설정 여성/남성 별도 설정
-- 캐릭터 gender에 따라 여성/남성 설정을 각각 적용
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_voice_config
  add column if not exists voice_style_female text default 'warm';

alter table public.panana_voice_config
  add column if not exists voice_style_male text default 'calm';

-- 기존 voice_style 값으로 마이그레이션
update public.panana_voice_config
set
  voice_style_female = coalesce(voice_style_female, voice_style, 'warm'),
  voice_style_male = coalesce(voice_style_male, voice_style, 'calm');

comment on column public.panana_voice_config.voice_style_female is '여성 캐릭터 말투: calm, bright, firm, empathetic, warm';
comment on column public.panana_voice_config.voice_style_male is '남성 캐릭터 말투: calm, bright, firm, empathetic, warm';
