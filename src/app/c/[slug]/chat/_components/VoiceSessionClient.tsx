"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioRecorder } from "@/lib/voice/genai-live/audio-recorder";
import { AudioStreamer } from "@/lib/voice/genai-live/audio-streamer";
import { audioContext, base64ToArrayBuffer } from "@/lib/voice/genai-live/utils";
import VolMeterWorklet from "@/lib/voice/genai-live/worklets/vol-meter";

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const MAX_RECONNECT_ATTEMPTS = 5;

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1)
  );
}

function resolveWsUrl(): string {
  const envProxy = String(process.env.NEXT_PUBLIC_VERTEX_LIVE_PROXY_URL || "").trim();
  if (envProxy) {
    if (envProxy.startsWith("ws://") || envProxy.startsWith("wss://")) return envProxy;
    if (envProxy.startsWith("http://") || envProxy.startsWith("https://")) {
      return envProxy.replace(/^http/, "ws");
    }
    return `${typeof window !== "undefined" ? window.location.origin : ""}${envProxy.startsWith("/") ? "" : "/"}${envProxy}`.replace(
      /^http/,
      "ws"
    );
  }
  // 로컬 개발: vertex-live-proxy가 4001 포트에서 실행 중일 때 기본값
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return "ws://localhost:4001";
  }
  return "";
}

function stripNarration(text: string): string {
  return String(text || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/『[^』]*』/g, "")
    .replace(/\*[^*]*\*/g, "")
    .replace(/_[^_]*_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function VoiceSessionClient({
  characterSlug,
  characterName,
  callSign,
  onClose,
  onUserTranscript,
  onAssistantTranscript,
  onVoiceModelReady,
  characterAvatarUrl,
  userAvatarUrl,
}: {
  characterSlug: string;
  characterName: string;
  callSign: string;
  onClose: () => void;
  onUserTranscript?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  /** 음성 세션 연결 시 사용 중인 음성 모델 라벨(캐릭터명 밑 표시용) */
  onVoiceModelReady?: (modelLabel: string) => void;
  characterAvatarUrl?: string;
  userAvatarUrl?: string;
}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectGaveUp, setReconnectGaveUp] = useState(false);
  const [inVolume, setInVolume] = useState(0);
  const [outVolume, setOutVolume] = useState(0);
  /** 마이크 민감도 0.5(낮음) ~ 2(높음). 음성 시작 후에도 변경 가능. */
  const [micSensitivity, setMicSensitivity] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const initSentRef = useRef(false);
  const userStoppedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const startedRef = useRef(false);
  const onUserRef = useRef(onUserTranscript);
  const onAssistantRef = useRef(onAssistantTranscript);
  onUserRef.current = onUserTranscript;
  onAssistantRef.current = onAssistantTranscript;
  const assistantBufferRef = useRef("");
  const assistantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userBufferRef = useRef("");
  const userDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** iOS: 사용자 탭 직후(await 전)에 마이크 권한 요청을 시작해 한 번만 컨펌받고 저장되도록 함 */
  const iosMicStreamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  /** iOS 17 등: 첫 오디오 수신 시 suspend→resume 워크어라운드 1회만 수행 */
  const iosContextWorkaroundDoneRef = useRef(false);
  /** iOS: 사용자 제스처와 같은 틱에 생성한 녹음용 AudioContext (Safari 요구사항) */
  const iosRecorderContextRef = useRef<AudioContext | null>(null);

  const flushUser = useCallback(() => {
    const buf = userBufferRef.current.trim();
    userBufferRef.current = "";
    if (userDebounceRef.current) {
      clearTimeout(userDebounceRef.current);
      userDebounceRef.current = null;
    }
    if (buf) onUserRef.current?.(buf);
  }, []);

  const flushAssistant = useCallback(() => {
    flushUser();
    const buf = assistantBufferRef.current.trim();
    assistantBufferRef.current = "";
    if (assistantDebounceRef.current) {
      clearTimeout(assistantDebounceRef.current);
      assistantDebounceRef.current = null;
    }
    if (buf) onAssistantRef.current?.(buf);
  }, [flushUser]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const ensurePlaybackResumed = useCallback(async () => {
    const streamer = streamerRef.current;
    if (!streamer) return;
    try {
      await streamer.resume();
    } catch {
      // ignore
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setReconnectGaveUp(false);
    const wsUrl = resolveWsUrl();
    if (!wsUrl) {
      setError("NEXT_PUBLIC_VERTEX_LIVE_PROXY_URL이 설정되지 않았어요.");
      return;
    }

    const res = await fetch(
      `/api/voice/prompt?characterSlug=${encodeURIComponent(characterSlug)}&callSign=${encodeURIComponent(callSign)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!data?.ok || !data?.systemPrompt) {
      setError(data?.error || "프롬프트를 불러올 수 없어요.");
      return;
    }

    const { systemPrompt, voiceConfig } = data;
    const model = voiceConfig?.base_model || LIVE_MODEL;
    const voiceName = voiceConfig?.voice_name || "Aoede";
    onVoiceModelReady?.(`Gemini · ${model}`);

    const config = {
      responseModalities: ["AUDIO" as const],
      proactivity: { proactiveAudio: true },
      speechConfig: {
        languageCode: "ko-KR",
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "ping" }));
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN && !initSentRef.current) {
          initSentRef.current = true;
          ws.send(JSON.stringify({ type: "init", model, config }));
        }
      }, 100);
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data || "{}"));
        if (msg.type === "ready") {
          reconnectAttemptRef.current = 0;
          setReconnectGaveUp(false);
          setConnected(true);
          return;
        }
        if (msg.type === "audio" && msg.data) {
          const buf = base64ToArrayBuffer(msg.data);
          const pcm = new Uint8Array(buf);
          const streamer = streamerRef.current;
          const doPlay = async () => {
            if (!streamer) return;
            // iOS 17: AudioContext가 running인데 소리 안 나는 WebKit 버그 대응 — 첫 오디오 시 1회 suspend→resume
            if (isIOSDevice() && !iosContextWorkaroundDoneRef.current) {
              iosContextWorkaroundDoneRef.current = true;
              const ctx = streamer.context;
              try {
                if (ctx.state === "running") {
                  await ctx.suspend();
                  await ctx.resume();
                } else {
                  await ctx.resume();
                }
              } catch {
                // ignore
              }
            }
            await ensurePlaybackResumed();
            streamer.addPCM16(pcm);
          };
          void doPlay();
          return;
        }
        if (msg.type === "error") {
          setError(msg.message || "음성 연결 오류");
        }
        if (msg.type === "interrupted") {
          streamerRef.current?.stop();
          flushAssistant();
        }
        if (msg.type === "transcript" && typeof msg.text === "string" && msg.text.trim()) {
          const role = msg.role === "user" ? "user" : "assistant";
          const raw = msg.text.trim();
          if (!raw) return;

          if (role === "user") {
            let toShow = raw;
            try {
              const res = await fetch("/api/translate-to-korean", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: raw }),
              });
              const data = await res.json().catch(() => ({}));
              if (data?.ok && typeof data.text === "string" && data.text.trim()) {
                toShow = data.text.trim();
              }
            } catch {
              // 실패 시 원문 표시
            }
            userBufferRef.current += (userBufferRef.current ? " " : "") + toShow;
            if (userDebounceRef.current) clearTimeout(userDebounceRef.current);
            userDebounceRef.current = setTimeout(() => {
              flushUser();
            }, 800);
          } else {
            const spokenOnly = stripNarration(raw);
            if (!spokenOnly) return;
            assistantBufferRef.current += (assistantBufferRef.current ? " " : "") + spokenOnly;
            const endsWithSentence = /[.?!…]\s*$/.test(assistantBufferRef.current) || /\n\s*$/.test(assistantBufferRef.current);
            if (assistantDebounceRef.current) clearTimeout(assistantDebounceRef.current);
            if (endsWithSentence) {
              flushAssistant();
            } else {
              assistantDebounceRef.current = setTimeout(() => {
                flushAssistant();
              }, 1200);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      if (!userStoppedRef.current) {
        setError("WebSocket 연결 오류");
      }
    };

    ws.onclose = () => {
      flushAssistant();
      flushUser();
      setConnected(false);
      initSentRef.current = false;

      if (wsRef.current === ws) {
        wsRef.current = null;
      }

      // 사용자가 명시적으로 끊지 않았고(started 유지), 연결이 닫히면 자동 재연결 (최대 MAX_RECONNECT_ATTEMPTS회)
      if (!userStoppedRef.current && startedRef.current) {
        clearReconnectTimer();
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;

        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          setReconnectGaveUp(true);
          setError("연결을 유지할 수 없어요. 아래 '다시 연결'로 재시도해 보세요.");
          return;
        }

        setReconnectGaveUp(false);
        setError("연결이 잠시 끊겼어요. 자동 재연결 중...");

        reconnectTimerRef.current = setTimeout(async () => {
          if (userStoppedRef.current || !startedRef.current) return;
          await connect();
          // fetch/초기화 단계에서 실패해 소켓이 안 만들어진 경우에도 재시도 유지
          if (!wsRef.current && !userStoppedRef.current && startedRef.current) {
            clearReconnectTimer();
            const nextAttempt = reconnectAttemptRef.current + 1;
            reconnectAttemptRef.current = nextAttempt;
            if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
              setReconnectGaveUp(true);
              setError("연결을 유지할 수 없어요. 아래 '다시 연결'로 재시도해 보세요.");
              return;
            }
            const nextRetryInMs = Math.min(1000 * 2 ** nextAttempt, 5000);
            reconnectTimerRef.current = setTimeout(async () => {
              if (userStoppedRef.current || !startedRef.current) return;
              await connect();
            }, nextRetryInMs);
          }
        }, Math.min(1000 * 2 ** (attempt - 1), 5000));
      }
    };
  }, [characterSlug, callSign, clearReconnectTimer, ensurePlaybackResumed, flushAssistant, flushUser]);

  useEffect(() => {
    // 기존 동작 유지: PC/Android는 마운트 시 선초기화
    // iOS만 클릭 제스처 시점(startVoice)으로 초기화 지연
    if (isIOSDevice()) {
      return () => {
        clearReconnectTimer();
        recorderRef.current?.stop();
        streamerRef.current?.stop();
        wsRef.current?.close();
        recorderRef.current = null;
        streamerRef.current = null;
      };
    }

    const setup = async () => {
      try {
        // 서버 PCM 24kHz와 동일한 context → 리샘플링 노이즈 완화(iOS 등)
        const outCtx = await audioContext({ id: "voice-panana-out", sampleRate: 24000 });
        const streamer = new AudioStreamer(outCtx);
        await streamer.addWorklet("vumeter-out", VolMeterWorklet, (d: unknown) => {
          const ev = d as MessageEvent;
          const vol = (ev?.data as { volume?: number })?.volume;
          if (typeof vol === "number") setOutVolume(vol);
        });
        streamerRef.current = streamer;
        await streamer.resume();

        const recorder = new AudioRecorder(16000);
        recorder.on("data", (base64: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN && initSentRef.current) {
            wsRef.current.send(JSON.stringify({ type: "audio", data: base64, mimeType: "audio/pcm;rate=16000" }));
          }
        });
        recorder.on("volume", (v: number) => setInVolume(v));
        recorderRef.current = recorder;
      } catch (e) {
        setError(e instanceof Error ? e.message : "오디오 초기화 실패");
      }
    };

    setup();

    return () => {
      clearReconnectTimer();
      recorderRef.current?.stop();
      streamerRef.current?.stop();
      wsRef.current?.close();
      recorderRef.current = null;
      streamerRef.current = null;
    };
  }, [clearReconnectTimer]);

  const [started, setStarted] = useState(false);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  // iOS Safari: 백그라운드 복귀/포커스 복귀 후 AudioContext가 suspended 상태가 되면 무음이 날 수 있어 복구한다.
  useEffect(() => {
    if (!isIOSDevice()) return;

    const resumeIfStarted = () => {
      if (!startedRef.current) return;
      void ensurePlaybackResumed();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeIfStarted();
      }
    };

    window.addEventListener("pageshow", resumeIfStarted);
    window.addEventListener("focus", resumeIfStarted);
    window.addEventListener("touchstart", resumeIfStarted, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", resumeIfStarted);
      window.removeEventListener("focus", resumeIfStarted);
      window.removeEventListener("touchstart", resumeIfStarted);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ensurePlaybackResumed]);

  const startVoice = useCallback(async () => {
    if (isIOSDevice()) {
      if (!iosRecorderContextRef.current) {
        iosRecorderContextRef.current = new AudioContext({ sampleRate: 16000 });
      }
    }
    if (isIOSDevice() && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && !iosMicStreamPromiseRef.current) {
      iosMicStreamPromiseRef.current = navigator.mediaDevices.getUserMedia({ audio: true });
    }

    // iOS: 사용자 제스처 직후 무음 재생으로 오디오 세션 활성화(논블로킹, 버튼 멈춤 방지)
    if (isIOSDevice() && typeof window !== "undefined") {
      const unlock = new Audio();
      unlock.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      void unlock.play().catch(() => {});
    }

    // iOS 전용: 사용자 클릭 제스처 내에서 오디오/마이크 초기화
    // 리서치: iOS Safari는 getUserMedia + AudioContext + createMediaStreamSource를 같은 제스처에서 해야 함.
    if (isIOSDevice() && (!recorderRef.current || !streamerRef.current)) {
      try {
        const outCtx = new AudioContext({ sampleRate: 24000 });
        await outCtx.resume();

        const streamer = new AudioStreamer(outCtx, { mergeChunkSamples: 48000 });
        await streamer.addWorklet("vumeter-out", VolMeterWorklet, (d: unknown) => {
          const ev = d as MessageEvent;
          const vol = (ev?.data as { volume?: number })?.volume;
          if (typeof vol === "number") setOutVolume(vol);
        });
        streamerRef.current = streamer;
        await streamer.resume();

        const recorder = new AudioRecorder(16000);
        recorder.on("data", (base64: string) => {
          if (wsRef.current?.readyState === WebSocket.OPEN && initSentRef.current) {
            wsRef.current.send(JSON.stringify({ type: "audio", data: base64, mimeType: "audio/pcm;rate=16000" }));
          }
        });
        recorder.on("volume", (v: number) => setInVolume(v));
        recorderRef.current = recorder;
      } catch (e) {
        setError(e instanceof Error ? e.message : "오디오 초기화 실패");
        return;
      }
    }

    if (!recorderRef.current || !streamerRef.current) return;
    userStoppedRef.current = false;
    reconnectAttemptRef.current = 0;
    setReconnectGaveUp(false);
    clearReconnectTimer();
    setError(null);
    void ensurePlaybackResumed();

    // iOS 16/17+: Safari는 제스처 직후에 스트림 확보 → 동일 제스처에서 만든 context로 즉시 소비해야 함.
    if (isIOSDevice() && iosMicStreamPromiseRef.current) {
      try {
        const stream = await iosMicStreamPromiseRef.current;
        iosMicStreamPromiseRef.current = null;
        const recCtx = iosRecorderContextRef.current;
        await recorderRef.current.start(stream, recCtx ?? undefined);
        iosRecorderContextRef.current = null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "마이크를 사용할 수 없어요.");
        return;
      }
    }

    await connect();

    if (!isIOSDevice()) {
      const stream = iosMicStreamPromiseRef.current ? await iosMicStreamPromiseRef.current : undefined;
      if (iosMicStreamPromiseRef.current) iosMicStreamPromiseRef.current = null;
      await recorderRef.current.start(stream);
    }
    recorderRef.current?.setGain(micSensitivity);
    setStarted(true);
  }, [clearReconnectTimer, connect, ensurePlaybackResumed, micSensitivity]);

  const stopVoice = useCallback(() => {
    userStoppedRef.current = true;
    reconnectAttemptRef.current = 0;
    iosContextWorkaroundDoneRef.current = false;
    if (iosRecorderContextRef.current) {
      iosRecorderContextRef.current.close().catch(() => {});
      iosRecorderContextRef.current = null;
    }
    clearReconnectTimer();
    setReconnectGaveUp(false);
    flushAssistant();
    flushUser();
    recorderRef.current?.stop();
    wsRef.current?.close();
    setConnected(false);
    setStarted(false);
    initSentRef.current = false;
  }, [clearReconnectTimer, flushAssistant, flushUser]);

  const retryConnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setReconnectGaveUp(false);
    setError(null);
    void connect();
  }, [clearReconnectTimer, connect]);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-panana-pink/30 bg-panana-pink/10 px-4 py-3">
      {/* 음성 AI 썸네일 (왼쪽) */}
      <div className="flex min-w-[2.5rem] justify-start">
        <div
          className="overflow-hidden rounded-full ring-1 ring-white/10 transition-transform"
          style={{
            width: 32,
            height: 32,
            transform: `scale(${1 + Math.min(outVolume * 2, 0.3)})`,
          }}
          aria-hidden
        >
          {characterAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={characterAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full bg-panana-pink/40" />
          )}
        </div>
      </div>
      {/* 끊기, 닫기 버튼 (가운데) */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {error && (
          <span className="truncate text-[11px] text-red-300">{error}</span>
        )}
        {started && (
          <div className="flex w-full max-w-[200px] items-center gap-2">
            <span className="whitespace-nowrap text-[11px] text-white/70">마이크 민감도</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={micSensitivity}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMicSensitivity(v);
                recorderRef.current?.setGain(v);
              }}
              className="h-1.5 flex-1 accent-panana-pink"
              aria-label="마이크 민감도"
            />
            <span className="w-7 text-right text-[11px] text-white/80">{micSensitivity.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!started ? (
            <button
              type="button"
              onClick={startVoice}
              disabled={!!error}
              style={{ touchAction: "manipulation" }}
              className="rounded-lg bg-panana-pink px-4 py-2 text-[13px] font-bold text-[#0B0C10] transition hover:bg-panana-pink/90 disabled:opacity-50 active:opacity-90"
            >
              음성 시작
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={stopVoice}
                className="rounded-lg bg-red-500/80 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-500"
              >
                끊기
              </button>
              {reconnectGaveUp && (
                <button
                  type="button"
                  onClick={retryConnect}
                  style={{ touchAction: "manipulation" }}
                  className="rounded-lg bg-panana-pink px-4 py-2 text-[13px] font-bold text-[#0B0C10] transition hover:bg-panana-pink/90"
                >
                  다시 연결
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/10"
          >
            닫기
          </button>
        </div>
      </div>
      {/* 내 썸네일 (오른쪽) */}
      <div className="flex min-w-[2.5rem] justify-end">
        <div
          className="overflow-hidden rounded-full ring-1 ring-white/10 transition-transform"
          style={{
            width: 32,
            height: 32,
            transform: `scale(${1 + Math.min(inVolume * 2, 0.3)})`,
          }}
          aria-hidden
        >
          {userAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={userAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full bg-panana-pink/40" />
          )}
        </div>
      </div>
    </div>
  );
}
