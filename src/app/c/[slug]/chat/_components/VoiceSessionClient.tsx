"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AudioRecorder } from "@/lib/voice/genai-live/audio-recorder";
import { AudioStreamer } from "@/lib/voice/genai-live/audio-streamer";
import { audioContext, base64ToArrayBuffer } from "@/lib/voice/genai-live/utils";
import VolMeterWorklet from "@/lib/voice/genai-live/worklets/vol-meter";

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

/** 통화 시간 MM:SS */
function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
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

function defaultHangupSoundUrlFromSupabase(): string | null {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!base) return null;
  return `${base}/storage/v1/object/public/panana-characters/voice/hangup.mp3`;
}

function setInlinePlaybackAttributes(audio: HTMLAudioElement) {
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
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
  onPhaseChange,
  startOnOpen = false,
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
  /** 링 중일 때 부모(헤더 아이콘)에서 흔들림 등 표시용 */
  onPhaseChange?: (phase: "idle" | "ringing" | "connected") => void;
  /** true면 모달이 열릴 때(전화 아이콘 탭과 동일 제스처) iOS에서 즉시 통화 시작 */
  startOnOpen?: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectGaveUp, setReconnectGaveUp] = useState(false);
  const [inVolume, setInVolume] = useState(0);
  const [outVolume, setOutVolume] = useState(0);
  const inVolumeRef = useRef(0);
  const outVolumeRef = useRef(0);
  inVolumeRef.current = inVolume;
  outVolumeRef.current = outVolume;
  const [displayVolume, setDisplayVolume] = useState({ in: 0, out: 0 });
  /** 마이크 민감도 0.5(낮음) ~ 2(높음). 음성 시작 후에도 변경 가능. */
  const [micSensitivity, setMicSensitivity] = useState(1);
  /** 'ringing' = 링 재생 중(전화 걸기), 'connected' = 통화 중 풀스크린 */
  const [phase, setPhase] = useState<"idle" | "ringing" | "connected">("idle");
  const [ringtoneUrl, setRingtoneUrl] = useState<string | null>(null);
  const [hangupSoundUrl, setHangupSoundUrl] = useState<string | null>(null);
  const [closingWithHangupSound, setClosingWithHangupSound] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [started, setStarted] = useState(false);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const hangupAudioRef = useRef<HTMLAudioElement | null>(null);
  const hangupPreloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const callDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const ringEndedRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const VOLUME_THROTTLE_MS = 50;
  const VOLUME_SMOOTHING = 0.38;
  useEffect(() => {
    if (phase !== "connected" || !started) return;
    const t = setInterval(() => {
      setDisplayVolume((prev) => ({
        in: prev.in + (inVolumeRef.current - prev.in) * VOLUME_SMOOTHING,
        out: prev.out + (outVolumeRef.current - prev.out) * VOLUME_SMOOTHING,
      }));
    }, VOLUME_THROTTLE_MS);
    return () => clearInterval(t);
  }, [phase, started]);

  const [shouldAutoStart, setShouldAutoStart] = useState(false);

  // 링톤 URL 로드 (모달 열릴 때). 링톤 없으면 자동으로 통화 시작해 "음성 통화를 시작할까요?" 화면 스킵
  useEffect(() => {
    fetch("/api/voice/config")
      .then((r) => r.json())
      .then((d) => {
        const cfg = (d?.data as any) || {};
        const url = cfg?.ringtone_url;
        const hangupUrl = cfg?.hangup_sound_url;
        if (hangupUrl && typeof hangupUrl === "string" && hangupUrl.trim()) {
          const normalized = hangupUrl.trim();
          setHangupSoundUrl(normalized);
          const pre = new Audio(normalized);
          pre.preload = "auto";
          pre.crossOrigin = "anonymous";
          setInlinePlaybackAttributes(pre);
          pre.load();
          hangupPreloadAudioRef.current = pre;
        }
        if (url && typeof url === "string" && url.trim()) {
          setRingtoneUrl(url.trim());
          setPhase("ringing");
        } else {
          setShouldAutoStart(true);
        }
      })
      .catch(() => setShouldAutoStart(true));
    return () => {
      if (hangupPreloadAudioRef.current) {
        hangupPreloadAudioRef.current.pause();
        hangupPreloadAudioRef.current = null;
      }
    };
  }, []);

  const RING_EARLY_MS = 1200;

  // 링 재생 + (종료 1200ms 전) 전화 연결 화면 전환
  useEffect(() => {
    if (phase !== "ringing" || !ringtoneUrl) return;
    const audio = new Audio(ringtoneUrl);
    if (isIOSDevice()) setInlinePlaybackAttributes(audio);
    ringAudioRef.current = audio;
    let earlyTimer: ReturnType<typeof setTimeout> | null = null;

    const switchToConnected = () => {
      ringEndedRef.current = true;
      setPhase("connected");
      ringAudioRef.current = null;
    };

    const onEnded = () => {
      switchToConnected();
    };

    const scheduleEarlySwitch = () => {
      const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      const delay = durationMs > RING_EARLY_MS ? durationMs - RING_EARLY_MS : 0;
      if (delay > 0) {
        earlyTimer = setTimeout(() => {
          earlyTimer = null;
          switchToConnected();
        }, delay);
      }
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", scheduleEarlySwitch);
    if (audio.readyState >= 1) scheduleEarlySwitch();
    audio.play().catch(() => onEnded());

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", scheduleEarlySwitch);
      if (earlyTimer) clearTimeout(earlyTimer);
      ringAudioRef.current = null;
    };
  }, [phase, ringtoneUrl]);

  // 통화 시간 타이머 (started && connected)
  useEffect(() => {
    if (!started) {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
      setCallDurationSec(0);
      return;
    }
    setPhase("connected");
    callDurationTimerRef.current = setInterval(() => {
      setCallDurationSec((s) => s + 1);
    }, 1000);
    return () => {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
    };
  }, [started]);
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
            // 발음대로 한글 표기(번역 아님). API 실패 시 원문 표시
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

  /** iOS 전용: 전화 아이콘 탭(사용자 제스처) 시점에 마이크/레코더만 준비. 링 종료 후 startVoice()가 같은 리소스로 연결. */
  const prepareIOSVoice = useCallback(async () => {
    if (!isIOSDevice()) return;
    if (recorderRef.current && streamerRef.current) return;
    try {
      if (!iosRecorderContextRef.current) {
        iosRecorderContextRef.current = new AudioContext({ sampleRate: 16000 });
      }
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && !iosMicStreamPromiseRef.current) {
        iosMicStreamPromiseRef.current = navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (typeof window !== "undefined") {
        const unlock = new Audio();
        unlock.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        void unlock.play().catch(() => {});
      }
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
    }
  }, []);

  const startVoice = useCallback(async () => {
    setPhase("connected");
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

    // iOS 전용: 사용자 클릭 제스처 내에서 오디오/마이크 초기화 (prepareIOSVoice로 미리 해둔 경우 스킵)
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

  // 링 종료 후 자동으로 통화 시작 (iOS는 전화 아이콘 탭 시 prepareIOSVoice로 마이크 확보해 둠)
  useEffect(() => {
    if (phase !== "connected" || started || !ringEndedRef.current) return;
    ringEndedRef.current = false;
    void startVoice();
  }, [phase, started, startVoice]);

  // 링톤 없을 때 자동 통화 시작 (iOS는 전화 아이콘 탭 시 prepareIOSVoice로 마이크 확보해 둠)
  useEffect(() => {
    if (!shouldAutoStart || phase !== "idle") return;
    setShouldAutoStart(false);
    void startVoice();
  }, [shouldAutoStart, phase, startVoice]);

  // iOS: 전화 아이콘 탭 시 사용자 제스처 안에서 마이크/레코더만 준비 → 링톤 재생 후 동일 UX로 자동 연결
  const startedByOpenRef = useRef(false);
  useLayoutEffect(() => {
    if (!startOnOpen || !isIOSDevice() || startedByOpenRef.current) return;
    startedByOpenRef.current = true;
    void prepareIOSVoice();
  }, [startOnOpen, prepareIOSVoice]);

  const stopVoiceCore = useCallback((opts?: { closeUi?: boolean; setIdle?: boolean }) => {
    const closeUi = opts?.closeUi !== false;
    const setIdle = opts?.setIdle !== false;
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
    if (setIdle) setPhase("idle");
    initSentRef.current = false;
    if (closeUi) onClose();
  }, [clearReconnectTimer, flushAssistant, flushUser, onClose]);

  const stopVoice = useCallback(() => {
    stopVoiceCore();
  }, [stopVoiceCore]);

  const resolveHangupSoundUrl = useCallback(async (): Promise<string | null> => {
    if (hangupSoundUrl && hangupSoundUrl.trim()) return hangupSoundUrl.trim();
    try {
      const res = await fetch("/api/voice/config");
      const data = await res.json().catch(() => ({}));
      const url = String((data?.data as any)?.hangup_sound_url || "").trim();
      if (url) {
        setHangupSoundUrl(url);
        return url;
      }
    } catch {
      // ignore
    }
    return defaultHangupSoundUrlFromSupabase();
  }, [hangupSoundUrl]);

  const handleHangupClick = useCallback(async () => {
    const resolvedUrl = await resolveHangupSoundUrl();
    if (resolvedUrl) {
      setClosingWithHangupSound(true);
      try {
        const audio = hangupPreloadAudioRef.current || new Audio(resolvedUrl);
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        setInlinePlaybackAttributes(audio);
        audio.currentTime = 0;
        audio.volume = 1;
        hangupAudioRef.current = audio;
        let teardownStarted = false;
        const startTeardown = () => {
          if (teardownStarted) return;
          teardownStarted = true;
          stopVoiceCore({ closeUi: false, setIdle: false });
        };
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          audio.onended = null;
          audio.onerror = null;
          hangupAudioRef.current = null;
          setClosingWithHangupSound(false);
          setPhase("idle");
          onClose();
        };
        const fallbackTimer = window.setTimeout(finish, 4500);
        audio.onended = () => {
          window.clearTimeout(fallbackTimer);
          finish();
        };
        audio.onerror = () => {
          window.clearTimeout(fallbackTimer);
          finish();
        };
        const playPromise = audio.play();
        // 재생을 먼저 시작시키고, 세션 정리는 다음 틱으로 미뤄 클릭 직후 소리가 늦게 나는 현상 최소화
        window.setTimeout(startTeardown, 0);
        void playPromise.catch(() => {
          // 1차 재생 실패 시 캐시버스터 URL로 1회 재시도
          const retry = new Audio(`${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
          retry.preload = "auto";
          retry.crossOrigin = "anonymous";
          setInlinePlaybackAttributes(retry);
          retry.volume = 1;
          hangupAudioRef.current = retry;
          window.setTimeout(startTeardown, 0);
          retry.onended = () => {
            window.clearTimeout(fallbackTimer);
            finish();
          };
          retry.onerror = () => {
            window.clearTimeout(fallbackTimer);
            finish();
          };
          void retry.play().catch(() => {
            window.clearTimeout(fallbackTimer);
            finish();
          });
        });
      } catch {
        setClosingWithHangupSound(false);
        setPhase("idle");
        onClose();
      }
      return;
    }
    stopVoice();
  }, [onClose, resolveHangupSoundUrl, stopVoice, stopVoiceCore]);

  const retryConnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setReconnectGaveUp(false);
    setError(null);
    void connect();
  }, [clearReconnectTimer, connect]);

  const fullScreenZ = "z-[100]";
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const overlayPosition = "fixed left-0 right-0 bottom-0 top-14";

  if (closingWithHangupSound) {
    const closingUI = (
      <div className={`${overlayPosition} ${fullScreenZ} flex items-center justify-center bg-[#0B0C10]`}>
        <p className="text-sm text-white/70">통화 종료 중...</p>
      </div>
    );
    return portalTarget ? createPortal(closingUI, portalTarget) : closingUI;
  }

  const voiceBounceStyle = (
    <style
      dangerouslySetInnerHTML={{
        __html: "@keyframes voice-bounce-dots{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}",
      }}
    />
  );
  const bouncingDots = (
    <span className="inline-flex gap-0.5" aria-hidden>
      <span className="opacity-70" style={{ animation: "voice-bounce-dots 0.6s ease-in-out infinite" }}>.</span>
      <span className="opacity-70" style={{ animation: "voice-bounce-dots 0.6s ease-in-out 0.2s infinite" }}>.</span>
      <span className="opacity-70" style={{ animation: "voice-bounce-dots 0.6s ease-in-out 0.4s infinite" }}>.</span>
    </span>
  );

  // idle: 연결 중 + 취소 (iOS는 전화 아이콘 탭 시 startOnOpen으로 즉시 통화 시작)
  if (phase === "idle") {
    const idleUI = (
      <div className={`${overlayPosition} ${fullScreenZ} flex flex-col items-center justify-center bg-[#0B0C10] gap-6`}>
        {voiceBounceStyle}
        <p className="text-sm text-white/70">
          연결 중{bouncingDots}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-panana-pink px-6 py-3 text-sm font-bold text-[#0B0C10] hover:bg-panana-pink/90"
        >
          취소
        </button>
      </div>
    );
    return portalTarget ? createPortal(idleUI, portalTarget) : idleUI;
  }

  // 링 중: 연결 중 + 취소 동시 표시
  if (phase === "ringing") {
    const cancelRinging = () => {
      ringAudioRef.current?.pause();
      ringAudioRef.current = null;
      setPhase("idle");
      onClose();
    };
    const ringingUI = (
      <div className={`${overlayPosition} ${fullScreenZ} flex flex-col items-center justify-center bg-[#0B0C10] gap-6`}>
        {voiceBounceStyle}
        <p className="text-sm text-white/70">
          연결 중{bouncingDots}
        </p>
        <button
          type="button"
          onClick={cancelRinging}
          className="rounded-full bg-panana-pink px-6 py-3 text-sm font-bold text-[#0B0C10] hover:bg-panana-pink/90"
        >
          취소
        </button>
      </div>
    );
    return portalTarget ? createPortal(ringingUI, portalTarget) : ringingUI;
  }

  // 통화 중(연결된 뒤에만): 전화 통화화면. 볼륨은 스로틀된 displayVolume 사용으로 리렌더 최소화
  if (phase === "connected" && started) {
    // 상한 없이 볼륨에 비례해 커지도록 정규화(하한만 0으로 제한)
    const normalizeVol = (v: number) => Math.max(0, (v - 0.004) * 20);
    const inLevelRaw = Math.max(0, displayVolume.in);
    const outLevelRaw = Math.max(0, displayVolume.out);
    const inLevel = normalizeVol(inLevelRaw);
    const outLevel = normalizeVol(outLevelRaw);
    const combined = Math.max(inLevel, outLevel);
    // 내 목소리/AI 목소리 어느 쪽이든 말하면 즉시 커지도록 반응 강화
    const wholeScale = 1 + combined * 0.9;
    // 탄성 바운스는 볼륨과 무관하게 천천히 둥실둥실
    const bounceDurationSec = 2.8;
    const inOpacity = 0.25 + inLevel * 0.75;
    const outOpacity = 0.25 + outLevel * 0.75;

    const callScreenKeyframes = `
@keyframes voice-profile-blink{0%,100%{opacity:1}50%{opacity:0.88}}
@keyframes voice-whole-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes voice-ring-spin{to{transform:rotate(360deg)}}
@keyframes voice-ring-spin-rev{to{transform:rotate(-360deg)}}
`;
    const connectedUI = (
      <div className={`${overlayPosition} ${fullScreenZ} flex flex-col items-center bg-[#0B0C10] pt-6 pb-6`}>
        <style dangerouslySetInnerHTML={{ __html: callScreenKeyframes }} />
        <div
          className="overflow-hidden rounded-full ring-2 ring-white/20 shrink-0"
          style={{ width: 80, height: 80, animation: "voice-profile-blink 2.5s ease-in-out infinite" }}
        >
          {characterAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={characterAvatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="eager" />
          ) : (
            <div className="h-full w-full bg-panana-pink/40" />
          )}
        </div>
        <p className="mt-3 text-base font-medium text-white/90">{characterName || "캐릭터"}</p>
        <p className="mt-1 text-sm text-white/60">{formatCallDuration(callDurationSec)}</p>
        <div className="relative mt-14 h-56 w-56 shrink-0" aria-hidden>
          <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2">
            <div
              className="relative h-full w-full"
              style={{
                transform: `scale(${wholeScale})`,
                animation: `voice-whole-bounce ${bounceDurationSec.toFixed(2)}s ease-in-out infinite`,
                willChange: "transform",
                transition: "transform 170ms cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  border: "4px solid rgba(236,72,153,0.65)",
                  boxShadow: `0 0 ${14 + combined * 60}px rgba(236,72,153,${0.45 + combined * 0.45})`,
                  transform: `translate(-50%, -50%) scale(${1 + combined * 0.28})`,
                  transition: "transform 170ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.92), rgba(255,255,255,0.2) 24%, rgba(236,72,153,0.78) 45%, rgba(88,28,135,0.88) 100%)",
                  transform: `translate(-50%, -50%) scale(${0.9 + combined * 0.35})`,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-300/80"
                style={{ transform: `translate(-50%, -50%) scale(${0.92 + combined * 0.45})` }}
              />
            </div>
          </div>
        </div>
        <button type="button" onClick={handleHangupClick} className="mt-auto mb-24 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-transparent" aria-label="전화 끊기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/call_end.png" alt="" width={56} height={56} className="opacity-90 hover:opacity-100" />
        </button>
        {error && (
          <span className="mt-2 truncate text-[11px] text-red-300">{error}</span>
        )}
        {reconnectGaveUp && (
          <button
            type="button"
            onClick={retryConnect}
            className="mt-2 text-sm text-panana-pink"
          >
          다시 연결
        </button>
        )}
      </div>
    );
    return portalTarget ? createPortal(connectedUI, portalTarget) : connectedUI;
  }

  // connected이지만 아직 started 전 (iOS는 전화 아이콘 탭 시 startOnOpen으로 이미 시작됨)
  if (phase === "connected" && !started) {
    const connectingUI = (
      <div className={`${overlayPosition} ${fullScreenZ} bg-[#0B0C10]`} aria-hidden />
    );
    return portalTarget ? createPortal(connectingUI, portalTarget) : connectingUI;
  }

  // 대기/컴팩트 바 (폴백)
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-panana-pink/30 bg-panana-pink/10 px-4 py-3">
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
            취소
          </button>
        </div>
      </div>
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
