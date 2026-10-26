"use client";

// ponytail: face-api.js lokal — matching 1:1 & liveness tantangan kedip;
// anti-spoofing kelas enterprise butuh PAD tersertifikasi (FaceTec/iBeta)

import type { FaceDetection } from "@vladmandic/face-api";
import * as faceapi from "@vladmandic/face-api";

let loadPromise: Promise<typeof faceapi> | null = null;

export function loadFaceApi(): Promise<typeof faceapi> {
  if (!loadPromise) {
    loadPromise = (async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
      return faceapi;
    })();
  }
  return loadPromise;
}

function detectorOptions() {
  return new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
}

/** Descriptor wajah dari elemen video/canvas; null bila wajah tidak terdeteksi. */
export async function detectDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<{ descriptor: number[]; detection: FaceDetection } | null> {
  const api = await loadFaceApi();
  const res = await api
    .detectSingleFace(input, detectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!res) return null;
  return { descriptor: Array.from(res.descriptor), detection: res.detection };
}

export interface LivenessFrame {
  descriptor: number[];
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Kumpulkan N frame wajah berurutan untuk variance check pasif.
 * Berhenti lebih awal bila dibatalkan; kembalikan frame yang berhasil (bisa < N).
 */
export async function sampleLivenessFrames(
  input: HTMLVideoElement,
  count: number,
  intervalMs: number,
  isCancelled: () => boolean,
  onTick?: (got: number) => void,
): Promise<LivenessFrame[]> {
  const frames: LivenessFrame[] = [];
  while (frames.length < count) {
    if (isCancelled()) break;
    const det = await detectDescriptor(input);
    if (det && det.detection.score > 0.5) {
      const b = det.detection.box;
      frames.push({ descriptor: det.descriptor, box: { x: b.x, y: b.y, width: b.width, height: b.height } });
      onTick?.(frames.length);
    }
    if (frames.length < count) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return frames;
}
