export type PananaIdentity = {
  id: string;
  handle: string; // @abcd1234
  nickname: string;
};

const LS_ID = "panana_identity_id";
const LS_HANDLE = "panana_identity_handle";
const LS_NICK = "panana_identity_nickname";

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function randomLetters(n: number) {
  const alpha = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < n; i++) out += alpha[randomInt(alpha.length)];
  return out;
}

function randomDigits(n: number) {
  let out = "";
  for (let i = 0; i < n; i++) out += String(randomInt(10));
  return out;
}

export function generatePananaHandle() {
  // 요구: @ + 영문 4자리 + 숫자 4자리
  return `@${randomLetters(4)}${randomDigits(4)}`;
}

export function isValidPananaHandle(handle: string) {
  return /^@[a-z]{4}\d{4}$/.test(String(handle || "").trim());
}

export function ensurePananaIdentity(): PananaIdentity {
  if (typeof window === "undefined") {
    // 서버에서는 로컬스토리지가 없으므로 더미 반환(클라에서 다시 덮어씀)
    return { id: "server", handle: "@panana0000", nickname: "파나나유저0000" };
  }

  let id = "";
  let handle = "";
  let nickname = "";
  try {
    id = String(window.localStorage.getItem(LS_ID) || "").trim();
    handle = String(window.localStorage.getItem(LS_HANDLE) || "").trim().toLowerCase();
    nickname = String(window.localStorage.getItem(LS_NICK) || "").trim();
  } catch {
    // ignore
  }

  if (!id) {
    try {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    } catch {
      id = `${Date.now()}-${Math.random()}`;
    }
  }

  // NOTE: handle은 이제 서버에서 UNIQUE 보장 발급/확정한다.
  // 로컬에는 "서버에서 받은 handle"을 저장하는 용도로만 사용하며,
  // 아직 없다면 임시값을 넣어두되, 화면에서는 서버 동기화가 우선된다.
  if (!isValidPananaHandle(handle)) handle = "@----0000";
  if (!nickname) nickname = "파나나유저";

  try {
    window.localStorage.setItem(LS_ID, id);
    window.localStorage.setItem(LS_HANDLE, handle);
    window.localStorage.setItem(LS_NICK, nickname);
  } catch {
    // ignore
  }

  return { id, handle, nickname };
}

export function setPananaHandle(handle: string) {
  if (typeof window === "undefined") return;
  const h = String(handle || "").trim().toLowerCase();
  if (!isValidPananaHandle(h)) return;
  try {
    window.localStorage.setItem(LS_HANDLE, h);
  } catch {}
}

export function setPananaId(id: string) {
  if (typeof window === "undefined") return;
  const v = String(id || "").trim();
  if (!v) return;
  try {
    window.localStorage.setItem(LS_ID, v);
  } catch {}
}

export function setPananaNickname(nickname: string) {
  if (typeof window === "undefined") return;
  const v = String(nickname || "").trim().slice(0, 24);
  if (!v) return;
  try {
    window.localStorage.setItem(LS_NICK, v);
  } catch {}
}

