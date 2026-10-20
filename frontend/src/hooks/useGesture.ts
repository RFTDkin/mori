'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type GestureType = 'cursor_move' | 'click' | 'double_click' | 'swipe_left' | 'swipe_right' | 'swipe_up' | 'swipe_down' | 'zoom_in' | 'zoom_out' | 'none';

export interface GestureEvent {
  type: GestureType;
  confidence: number;
  timestamp: number;
  x?: number;
  y?: number;
}

interface HandLandmark { x: number; y: number; z: number; }

const PINCH_THRESHOLD = 0.055;
const SWIPE_DISTANCE = 0.16;
const SWIPE_FRAMES = 9;
const SWIPE_COOLDOWN = 600;
const DOUBLE_CLICK_MS = 430;
const ZOOM_DISTANCE = 0.08;

const distance = (a: HandLandmark, b: HandLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
const isPinching = (hand: HandLandmark[]) => distance(hand[4], hand[8]) < PINCH_THRESHOLD;

/** Point to move, pinch to click, pinch twice to double-click; use two pinched hands to zoom. */
export default function useGesture(onGesture: (gesture: GestureEvent) => void, enabled = false) {
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<'starting' | 'searching' | 'tracking' | 'error'>('starting');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onGestureRef = useRef(onGesture);
  const positionHistoryRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const pinchActiveRef = useRef(false);
  const lastClickRef = useRef(0);
  const lastSwipeRef = useRef(0);
  const zoomBaselineRef = useRef<number | null>(null);
  const lastCursorRef = useRef(0);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onGestureRef.current = onGesture; }, [onGesture]);

  const emit = useCallback((type: GestureType, details: Partial<GestureEvent> = {}, transient = true) => {
    const now = Date.now();
    if (transient) {
      setCurrentGesture(type);
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
      labelTimerRef.current = setTimeout(() => setCurrentGesture('none'), 700);
    }
    onGestureRef.current({ type, confidence: 0.9, timestamp: now, ...details });
  }, []);

  const analyseHands = useCallback((hands: HandLandmark[][]) => {
    const now = Date.now();
    const primary = hands[0];
    if (!primary) return;

    // Match the mirrored camera preview so pointing feels natural.
    const x = 1 - primary[8].x;
    const y = primary[8].y;
    if (now - lastCursorRef.current > 32) {
      lastCursorRef.current = now;
      emit('cursor_move', { x, y }, false);
    }

    // Two pinched hands avoid clashing with the one-hand click gesture.
    if (hands.length >= 2 && isPinching(hands[0]) && isPinching(hands[1])) {
      const center = (hand: HandLandmark[]) => ({ x: (hand[4].x + hand[8].x) / 2, y: (hand[4].y + hand[8].y) / 2, z: 0 });
      const handDistance = distance(center(hands[0]), center(hands[1]));
      const baseline = zoomBaselineRef.current;
      if (baseline === null) zoomBaselineRef.current = handDistance;
      else if (Math.abs(handDistance - baseline) > ZOOM_DISTANCE) {
        emit(handDistance > baseline ? 'zoom_in' : 'zoom_out');
        zoomBaselineRef.current = handDistance;
      }
      pinchActiveRef.current = true;
      positionHistoryRef.current = [];
      return;
    }
    zoomBaselineRef.current = null;

    if (isPinching(primary)) {
      if (!pinchActiveRef.current) {
        pinchActiveRef.current = true;
        const isDoubleClick = now - lastClickRef.current < DOUBLE_CLICK_MS;
        lastClickRef.current = now;
        emit(isDoubleClick ? 'double_click' : 'click', { x, y });
      }
      positionHistoryRef.current = [];
      return;
    }
    pinchActiveRef.current = false;

    // An open moving hand works like a phone swipe: left/right navigates and up/down scrolls.
    const history = positionHistoryRef.current;
    history.push({ x: primary[0].x, y: primary[0].y, time: now });
    while (history.length > SWIPE_FRAMES) history.shift();
    if (history.length < SWIPE_FRAMES || now - lastSwipeRef.current < SWIPE_COOLDOWN) return;
    const first = history[0];
    const last = history[history.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE || last.time - first.time > 850) return;
    lastSwipeRef.current = now;
    positionHistoryRef.current = [];
    if (Math.abs(dx) > Math.abs(dy)) emit(dx < 0 ? 'swipe_left' : 'swipe_right');
    else emit(dy < 0 ? 'swipe_up' : 'swipe_down');
  }, [emit]);

  const initHandLandmarker = useCallback(async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;
      // Keep the WASM runtime on the same version as package.json. Using "latest"
      // can silently mismatch the locally installed API and leave tracking idle.
      const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
      const options = {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const, numHands: 2,
        // 0.5 was too strict for many laptop cameras, especially indoors.
        minHandDetectionConfidence: 0.2, minHandPresenceConfidence: 0.2, minTrackingConfidence: 0.2,
      };
      try {
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, options);
      } catch (gpuError) {
        // Some integrated graphics drivers initialise WebGL but cannot run this
        // model reliably. CPU is slower but much more dependable for a 640px feed.
        console.warn('[Gesture] GPU unavailable; switching to CPU tracking.', gpuError);
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
        });
      }
      return true;
    } catch (error) { console.error('[Gesture] Failed to initialize HandLandmarker:', error); setDetectionStatus('error'); return false; }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      streamRef.current = stream;
      // The <video> element is conditionally rendered based on isActive,
      // so it may not exist yet. Poll briefly until it mounts.
      const waitForVideo = () => new Promise<HTMLVideoElement | null>((resolve) => {
        if (videoRef.current) return resolve(videoRef.current);
        let tries = 0;
        const id = setInterval(() => {
          tries++;
          if (videoRef.current) { clearInterval(id); resolve(videoRef.current); }
          else if (tries > 50) { clearInterval(id); resolve(null); }
        }, 50);
      });
      const video = await waitForVideo();
      if (video) { video.srcObject = stream; await video.play(); }
      else { console.warn('[Gesture] Video element not found after waiting'); }
      return true;
    } catch (error) { console.error('[Gesture] Camera access failed:', error); setDetectionStatus('error'); return false; }
  }, []);

  const lastTimestampRef = useRef(0);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) { animationFrameRef.current = requestAnimationFrame(detectLoop); return; }
    try {
      // detectForVideo requires a strictly increasing timestamp.
      const now = performance.now();
      if (now <= lastTimestampRef.current) { animationFrameRef.current = requestAnimationFrame(detectLoop); return; }
      lastTimestampRef.current = now;
      const hands = (landmarker.detectForVideo(video, now).landmarks || []) as HandLandmark[][];
      if (hands.length) { setLandmarks(hands[0]); setDetectionStatus('tracking'); analyseHands(hands); }
      else { setLandmarks(null); setDetectionStatus('searching'); pinchActiveRef.current = false; positionHistoryRef.current = []; }
    } catch (error) {
      console.error('[Gesture] Hand detection failed:', error);
      setDetectionStatus('error');
    }
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [analyseHands]);

  const start = useCallback(async () => {
    setDetectionStatus('starting');
    if (!(await initHandLandmarker())) return;
    // Render the <video> element first so startCamera can attach the stream.
    setIsActive(true);
    if (!(await startCamera())) return;
    lastTimestampRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop, initHandLandmarker, startCamera]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    handLandmarkerRef.current?.close(); handLandmarkerRef.current = null;
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    setIsActive(false); setLandmarks(null); setCurrentGesture('none'); setDetectionStatus('starting');
  }, []);

  useEffect(() => { if (enabled) start(); else stop(); return stop; }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return { isActive, currentGesture, landmarks, detectionStatus, videoRef, canvasRef, start, stop };
}
