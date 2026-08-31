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

export function detectorOptions() {
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

export async function detectFaceOnly(input: HTMLVideoElement): Promise<FaceDetection | null> {
  const api = await loadFaceApi();
  const res = await api.detectSingleFace(input, detectorOptions());
  return res ?? null;
}

export interface EyeAspect {
  ear: number;
}

/** Eye Aspect Ratio dari landmark 68 — dipakai untuk deteksi kedipan. */
export function earFromLandmarks(positions: { x: number; y: number }[], side: "left" | "right"): number {
  const off = side === "left" ? 36 : 42;
  const p = (i: number) => positions[off + i];
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const horizontal = d(p(0), p(3));
  if (!horizontal) return 0;
  return (d(p(1), p(5)) + d(p(2), p(4))) / (2 * horizontal);
}

export async function detectEar(input: HTMLVideoElement): Promise<number> {
  const api = await loadFaceApi();
  const res = await api.detectSingleFace(input, detectorOptions()).withFaceLandmarks();
  if (!res) return 0;
  return (earFromLandmarks(res.landmarks.positions, "left") + earFromLandmarks(res.landmarks.positions, "right")) / 2;
}
