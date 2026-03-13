/**
 * KST(한국 표준시) 기준 시각 유틸.
 * DB 기록 시 시간을 모두 KST로 통일할 때 사용합니다.
 */

const KST_TZ = "Asia/Seoul";

/** 현재 시각을 KST 기준 ISO 문자열로 반환 (예: 2025-02-20T00:00:00+09:00). DB created_at 등에 사용 */
export function nowKstIso(): string {
  const s = new Date().toLocaleString("en-CA", { timeZone: KST_TZ });
  return s.replace(", ", "T") + "+09:00";
}

/** 해당 Date를 KST 기준 ISO 문자열로 반환 */
export function toKstIso(d: Date): string {
  const s = d.toLocaleString("en-CA", { timeZone: KST_TZ });
  return s.replace(", ", "T") + "+09:00";
}

/** KST 오늘 날짜 YYYY-MM-DD (일일 보너스 등 날짜 기준 로직용) */
export function todayKst(): string {
  return new Date().toLocaleString("en-CA", { timeZone: KST_TZ }).slice(0, 10);
}
