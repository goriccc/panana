## LLM 키/설정 운영 방식(권장)

### 원칙
- **API Key는 DB에 저장하지 않습니다.**
  - 유출/오남용 리스크가 크기 때문에 **Vercel 환경변수(서버 전용)**로만 관리합니다.
- **temperature/safety/model 같은 운영 파라미터**는 DB(Supabase)로 저장하고 Admin에서 조정합니다.

### Vercel Environment Variables (서버 전용)
- **ANTHROPIC_API_KEY**: Claude(Anthropic)
- **GEMINI_API_KEY** 또는 **GOOGLE_GEMINI_API_KEY**: Gemini
- **DEEPSEEK_API_KEY**: DeepSeek

Supabase(앱 읽기용)
- **NEXT_PUBLIC_SUPABASE_URL**
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** (Legacy anon, `eyJ...`)

### Supabase SQL
- `docs/panana-admin/LLM_SCHEMA.sql` 실행 후 `/admin/llm`에서 설정을 조정합니다.

### 서버 호출 엔드포인트
- `POST /api/llm/chat`
  - provider별 API Key는 Vercel env에서만 읽습니다.
  - temperature/model 등은 기본적으로 DB의 `panana_llm_settings(scope=global)`을 사용합니다.

