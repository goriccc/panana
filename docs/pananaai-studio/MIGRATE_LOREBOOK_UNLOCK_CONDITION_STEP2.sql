-- Studio Lorebook Unlock Condition Migration (STEP 2)
-- 전제: STEP 1 (enum 확장 + 컬럼 추가) 실행이 먼저 완료되어야 함.
-- 목적: 과거 unlock_sku에 "COND:..." 로 저장된 데이터를 정식 컬럼(unlock_expr/unlock_cost_panana)로 변환

-- 데이터 변환: unlock_sku = 'COND:<expr>' 또는 'COND:<expr>|PANA:<cost>'
-- 기존에는 unlock_type='paid_item'에 cond를 우회 저장했으므로 이를 condition으로 승격.
with src as (
  select
    id,
    unlock_sku,
    -- expr: "COND:" 뒤부터 "|"(있으면) 전까지
    nullif(split_part(replace(unlock_sku, 'COND:', ''), '|', 1), '') as expr,
    -- cost: "|PANA:<n>"가 있으면 숫자만 추출
    case
      when unlock_sku like '%|PANA:%' then nullif(regexp_replace(split_part(unlock_sku, '|PANA:', 2), '[^0-9]', '', 'g'), '')
      else null
    end as cost_txt
  from public.lorebook_entries
  where unlock_sku like 'COND:%'
)
update public.lorebook_entries e
set
  unlock_type = 'condition',
  unlock_expr = coalesce(e.unlock_expr, src.expr),
  unlock_cost_panana = coalesce(e.unlock_cost_panana, nullif(src.cost_txt, '')::int),
  -- condition은 sku가 "아이템 SKU" 의미가 아니므로 기본은 비움(필요 시 별도 SKU 전략으로 사용)
  unlock_sku = case
    when e.unlock_sku like 'COND:%' then null
    else e.unlock_sku
  end
from src
where e.id = src.id;

