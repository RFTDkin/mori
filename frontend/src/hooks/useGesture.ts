'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type GestureType = 'swipe_left' | 'swipe_right' | 'fist' | 'none';

export interface GestureEvent {
  type: GestureType;
  confidence: number;
  timestamp: number;
}

interface HandLandmark { x: number; y: number; z: number; }

const FINGER_TIPS = [8, 12, 16, 20];
const FINGER_PIPS = [6, 10, 14, 18];
const SWIPE_DISTANCE = 0.14;
const SWIPE_FRAMES = 8;
const COOLDOWN_MS = 700;
const distance = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Deliberately minimal presentation controls:
 * open five-finger hand + move left/right = browse; closed fist = dismiss.
 */
export default function useGesture(onGesture: (gesture: GestureEvent) => void, enabled = false) {
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<'starting' | 'searching' | 'tracking' | 'error'>('starting');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onGestureRef = useRef(onGesture);
  const historyRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastGestureRef = useRef(0);
  const fistActiveRef = useRef(false);
  const lastTimestampRef = useRef(0);

  useEffect(() => { onGestureRef.current = onGesture; }, [onGesture]);

  const emit = useCallback((type: GestureType) => {
    const now = Date.now();
    setCurrentGesture(type);
    onGestureRef.current({ type, confidence: 0.9, timestamp: now });
    window.setTimeout(() => setCurrentGesture('none'), 600);
  }, []);

  const analyseHand = useCallback((hand: HandLandmark[]) => {
    const now = Date.now();
    const extended = FINGER_TIPS.map((tip, index) => hand[tip].y < hand[FINGER_PIPS[index]].y);
    const extendedCount = extended.filter(Boolean).length;

    // Do not treat a sideways open hand as a fist. A fist must have all four
    // fingertips physically close to the wrist relative to palm width.
    const palmWidth = distance(hand[5], hand[17]);
    const compactFist = palmWidth > 0.02 && FINGER_TIPS.every((tip) => distance(hand[tip], hand[0]) < palmWidth * 1.45);
    if (compactFist) {
      historyRef.current = [];
      if (!fistActiveRef.current && now - lastGestureRef.current > COOLDOWN_MS) {
        fistActiveRef.current = true;
        lastGestureRef.current = now;
        emit('fist');
      }
      return;
    }
    fistActiveRef.current = false;

    // Navigation deliberately requires a clear open hand (four extended
    // fingers). Accidental motion with a pointing finger does nothing.
    if (extendedCount < 4) {
      historyRef.current = [];
      return;
    }
    const history = historyRef.current;
    history.push({ x: hand[0].x, y: hand[0].y, time: now });
    while (history.length > SWIPE_FRAMES) history.shift();
    if (history.length < SWIPE_FRAMES || now - lastGestureRef.current < COOLDOWN_MS) return;
    const first = history[0];
    const last = history[history.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) || last.time - first.time > 850) return;
    historyRef.current = [];
    lastGestureRef.current = now;
    emit(dx < 0 ? 'swipe_left' : 'swipe_right');
  }, [emit]);

  const init = useCallback(async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
      const options = {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const, numHands: 1,
        minHandDetectionConfidence: 0.2, minHandPresenceConfidence: 0.2, minTrackingConfidence: 0.2,
      };
      try { landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, options); }
      catch { landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' as const } }); }
      return true;
    } catch (error) { console.error('[Gesture] Initialization failed:', error); setDetectionStatus('error'); return false; }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      streamRef.current = stream;
      const video = await new Promise<HTMLVideoElement | null>((resolve) => {
        if (videoRef.current) return resolve(videoRef.current);
        const timer = window.setInterval(() => { if (videoRef.current) { window.clearInterval(timer); resolve(videoRef.current); } }, 40);
        window.setTimeout(() => { window.clearInterval(timer); resolve(null); }, 2500);
      });
      if (!video) return false;
      video.srcObject = stream;
      await video.play();
      return true;
    } catch (error) { console.error('[Gesture] Camera failed:', error); setDetectionStatus('error'); return false; }
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) { animationFrameRef.current = requestAnimationFrame(loop); return; }
    try {
      const timestamp = performance.now();
      if (timestamp > lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
        const hands = landmarker.detectForVideo(video, timestamp).landmarks as HandLandmark[][];
        if (hands?.length) { setLandmarks(hands[0]); setDetectionStatus('tracking'); analyseHand(hands[0]); }
        else { setLandmarks(null); setDetectionStatus('searching'); historyRef.current = []; }
      }
    } catch (error) { console.error('[Gesture] Detection failed:', error); setDetectionStatus('error'); }
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [analyseHand]);

  const start = useCallback(async () => {
    setDetectionStatus('starting');
    if (!(await init())) return;
    setIsActive(true);
    if (!(await startCamera())) { setIsActive(false); return; }
    lastTimestampRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [init, loop, startCamera]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close(); landmarkerRef.current = null;
    setIsActive(false); setLandmarks(null); setCurrentGesture('none'); setDetectionStatus('starting');
  }, []);

  useEffect(() => { if (enabled) start(); else stop(); return stop; }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return { isActive, currentGesture, landmarks, detectionStatus, videoRef, canvasRef, start, stop };
}
