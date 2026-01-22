"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type GateState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "ready"; userId: string };

type GateStep = "idle" | "get_session" | "check_admin" | "done";

type AdminAllowlistRow = {
  user_id: string;
  active: boolean;
};

// UX 최적값: "무한 대기" 대신 넉넉한 타임아웃 + 실패 시 재시도 UX
// - 세션 조회는 보통 즉시 끝나지만, 네트워크/브라우저 상태에 따라 지연될 수 있어 20~30초가 체감상 안정적
const SESSION_TIMEOUT_MS = 25_000;
const ADMIN_CHECK_TIMEOUT_MS = 12_000;
const ADMIN_CACHE_KEY = "panana_admin_verified_v1";
const ADMIN_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12시간(체감상 충분히 길고, 권한 변경도 과하게 늦지 않게)

function readAdminCache(): { userId: string; exp: number } | null {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown; exp?: unknown };
    if (typeof parsed?.userId !== "string") return null;
    if (typeof parsed?.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { userId: parsed.userId, exp: parsed.exp };
  } catch {
    return null;
  }
}

function writeAdminCache(userId: string) {
  try {
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ userId, exp: Date.now() + ADMIN_CACHE_TTL_MS }));
  } catch {
    // ignore
  }
}

function clearAdminCache() {
  try {
    localStorage.removeItem(ADMIN_CACHE_KEY);
  } catch {
    // ignore
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)),
  ]);
}

export function AdminAuthGate({
  children,
  hideLogoutButton,
}: {
  children: React.ReactNode;
  hideLogoutButton?: boolean;
}) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [gate, setGate] = useState<GateState>({ status: "loading" });
  const [step, setStep] = useState<GateStep>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      setDebug(null);
      setStep("get_session");
      const { data: sessionData, error: sessionErr } = await withTimeout(
        supabase.auth.getSession(),
        SESSION_TIMEOUT_MS,
        "auth.getSession"
      );
      if (sessionErr) throw sessionErr;
      const session = sessionData.session;
      if (!session?.user?.id) {
        clearAdminCache();
        setGate({ status: "signed_out" });
        setStep("done");
        return;
      }

      const userId = session.user.id;
      setDebug(`user_id: ${userId}`);

      // 1) 캐시가 있으면 즉시 통과(UX: 화면 전환마다 DB 체크 때문에 "재로그인 느낌" 방지)
      const cached = readAdminCache();
      const hasValidCache = cached?.userId === userId;
      if (hasValidCache) {
        setGate({ status: "ready", userId });
      }

      // 2) 백그라운드로 allowlist 재검증(권한 회수/변경은 TTL 내에서만 지연)
      setStep("check_admin");
      try {
        const adminRes = await withTimeout<{ data: AdminAllowlistRow | null; error: any }>(
          (supabase
            .from("panana_admin_users")
            .select("user_id, active")
            .eq("user_id", userId)
            .maybeSingle() as any),
          ADMIN_CHECK_TIMEOUT_MS,
          "select panana_admin_users"
        );
        const { data: adminRow, error: adminErr } = adminRes;

        if (adminErr) throw adminErr;

        if (!adminRow?.active) {
          clearAdminCache();
          setGate({ status: "not_admin" });
          setStep("done");
          return;
        }

        writeAdminCache(userId);
        setGate({ status: "ready", userId });
        setStep("done");
      } catch (e: any) {
        const msg = e?.message || "관리자 권한 확인에 실패했어요.";
        setError(msg);
        setStep("done");

        // 핵심 UX: 일시적인 네트워크/타임아웃/5xx 등은 '권한 없음/로그아웃'으로 떨어뜨리지 않음
        // - 캐시가 있으면 그대로 사용(ready 유지)
        // - 캐시가 없으면 loading + 재시도 제공
        if (hasValidCache) {
          setGate({ status: "ready", userId });
          return;
        }
        setGate({ status: "loading" });
        return;
      }
    } catch (e: any) {
      const msg = e?.message || "권한 확인 중 오류가 발생했어요.";
      setError(msg);
      setStep("done");

      // 핵심 UX: 네트워크/타임아웃은 "로그아웃됨"으로 처리하지 않고
      // 로딩 상태 유지 + 재시도 버튼 제공 (사용자가 '매번 로그인' 느낌을 안 받게)
      if (String(msg).includes("timeout")) {
        setGate({ status: "loading" });
        return;
      }

      // 그 외(실제 세션 없음 등)는 기존대로 로그인 화면으로
      setGate({ status: "signed_out" });
    }
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      // event별로 분기할 수도 있지만, 현재는 refresh가 충분히 가볍고
      // 캐시/소프트 실패 처리로 UX가 안정적이라 그대로 유지
      refresh();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gate.status === "loading") {
    return (
      <div className="text-[13px] font-semibold text-white/60">
        로딩 중...
        {error ? <div className="mt-2 text-[12px] font-semibold text-[#ff9aa1]">{error}</div> : null}
        <div className="mt-2 text-[12px] font-semibold text-white/35">
          step: <span className="text-white/55">{step}</span>
        </div>
        {debug ? <div className="mt-1 text-[11px] font-semibold text-white/25">{debug}</div> : null}
        {error ? (
          <button
            type="button"
            className="mt-4 rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => refresh()}
          >
            다시 시도
          </button>
        ) : null}
      </div>
    );
  }

  if (gate.status === "signed_out") {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <div className="text-[16px] font-extrabold text-white/85">관리자 로그인</div>
        <div className="mt-2 text-[12px] font-semibold text-white/40">
          Supabase Auth(Email/Password)로 로그인 후, 해당 유저의 UID를 `panana_admin_users`에 등록해야 합니다.
        </div>

        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <label className="block">
            <div className="text-[12px] font-bold text-white/55">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 outline-none focus:border-white/20"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <div className="text-[12px] font-bold text-white/55">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 outline-none focus:border-white/20"
              placeholder="••••••••"
            />
          </label>

          {error ? <div className="text-[12px] font-semibold text-[#ff9aa1]">{error}</div> : null}
          {debug ? <div className="text-[11px] font-semibold text-white/25">{debug}</div> : null}

          <button
            type="button"
            className="mt-2 w-full rounded-xl bg-[#4F7CFF] px-4 py-3 text-[13px] font-extrabold text-white hover:bg-[#3E6BFF]"
            onClick={async () => {
              setError(null);
              const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
              if (error) setError(error.message);
            }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  if (gate.status === "not_admin") {
    return (
      <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="text-[14px] font-extrabold text-white/85">권한이 없어요</div>
        <div className="mt-2 text-[12px] font-semibold text-white/45">
          현재 로그인한 계정은 `panana_admin_users` allowlist에 등록되지 않았거나 비활성 상태입니다.
          <br />
          Supabase SQL Editor에서 아래처럼 본인 UID(UUID)를 등록하세요.
        </div>
        {error ? <div className="mt-2 text-[12px] font-semibold text-[#ff9aa1]">{error}</div> : null}
        {debug ? <div className="mt-1 text-[11px] font-semibold text-white/25">{debug}</div> : null}
        <pre className="mt-3 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] font-semibold text-white/70">
insert into public.panana_admin_users (user_id)
values ('YOUR_AUTH_USER_UUID');
        </pre>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => supabase.auth.signOut()}
          >
            로그아웃
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
            onClick={() => refresh()}
          >
            다시 확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!hideLogoutButton ? (
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => supabase.auth.signOut()}
          >
            로그아웃
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

