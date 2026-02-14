/**
 * Vendored from Google live-api-web-console (Apache-2.0).
 */

import { audioContext } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";
import VolMeterWorklet from "./worklets/vol-meter";
import { createWorkletFromSrc } from "./audioworklet-registry";
import EventEmitter from "eventemitter3";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super();
  }

  /**
   * @param existingStream 사용자 제스처 직후 취득한 스트림 (iOS 17+ 마이크 즉시 소비용)
   * @param existingContext iOS: 제스처 직후 동기 생성한 녹음용 AudioContext (같은 틱에 소비 보장)
   */
  async start(existingStream?: MediaStream, existingContext?: AudioContext) {
    if (existingStream) {
      this.stream = existingStream;
      const audioTrack = this.stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        if (audioTrack.readyState !== "live") {
          const e = new Error("마이크 트랙이 활성 상태가 아니에요. (iOS: 한 번 끊기 후 다시 시도해 보세요.)");
          (e as any).trackState = audioTrack.readyState;
          throw e;
        }
      }
      const ctx = existingContext ?? new AudioContext({ sampleRate: this.sampleRate });
      this.audioContext = ctx;
      this.source = this.audioContext.createMediaStreamSource(this.stream);
    } else if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Could not request user media");
    }

    this.starting = new Promise(async (resolve) => {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices!.getUserMedia({ audio: true });
        const audioTrack = this.stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = true;
      }
      if (!this.audioContext || !this.source) {
        this.audioContext = await audioContext({ sampleRate: this.sampleRate });
        this.source = this.audioContext.createMediaStreamSource(this.stream!);
      }
      await this.audioContext.resume();

      const workletName = "audio-recorder-worklet";
      const src = createWorkletFromSrc(workletName, AudioRecordingWorklet);
      await this.audioContext.audioWorklet.addModule(src);
      this.recordingWorklet = new AudioWorkletNode(this.audioContext, workletName);

      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        const arrayBuffer = (ev.data as any)?.data?.int16arrayBuffer;
        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          this.emit("data", arrayBufferString);
        }
      };
      this.source.connect(this.recordingWorklet);

      const vuWorkletName = "vu-meter";
      await this.audioContext.audioWorklet.addModule(createWorkletFromSrc(vuWorkletName, VolMeterWorklet));
      this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
      this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        this.emit("volume", (ev.data as any).volume);
      };

      this.source.connect(this.vuWorklet);
      this.recording = true;
      resolve();
      this.starting = null;
    });
  }

  stop() {
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      const ctx = this.audioContext;
      this.audioContext = undefined;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
      this.source = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}
