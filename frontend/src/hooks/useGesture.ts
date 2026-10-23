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
const SWIPE_DISTANCE = 0.08;
const SWIPE_FRAMES = 5;
const SWIPE_MAX_TIME = 1200;
const COOLDOWN_MS = 700;
/** How long (ms) a fist must be held before it triggers a dismiss event.
 *  This prevents accidental fist detection while the hand is mid-swipe. */
const FIST_HOLD_MS = 300;
/** Small y-tolerance (normalised) added to the finger-extension check so that
 *  a slightly tilted hand is still recognised as "open". */
const EXTENSION_TOLERANCE = 0.025;
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
  /** Timestamp when continuous fist pose was first detected. */
  const fistStartRef = useRef(0);
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
    // Use a small y-tolerance so that a slightly tilted or sideways hand
    // is still recognised as having extended fingers.
    const extended = FINGER_TIPS.map((tip, index) =>
      hand[tip].y < hand[FINGER_PIPS[index]].y + EXTENSION_TOLERANCE
    );
    const extendedCount = extended.filter(Boolean).length;

    // Do not treat a sideways open hand as a fist. A fist must have all four
    // fingertips physically close to the wrist relative to palm width.
    const palmWidth = distance(hand[5], hand[17]);
    // Check how many fingertips are curled (tip below PIP or close to palm centre)
    const palmCenter = { x: (hand[0].x + hand[9].x) / 2, y: (hand[0].y + hand[9].y) / 2, z: 0 };
    const tipsCurled = FINGER_TIPS.filter((tip, index) =>
      hand[tip].y > hand[FINGER_PIPS[index]].y - EXTENSION_TOLERANCE ||
      distance(hand[tip], palmCenter) < palmWidth * 1.0
    ).length;
    const compactFist = palmWidth > 0.02 && tipsCurled >= 3 &&
      FINGER_TIPS.every((tip) => distance(hand[tip], hand[0]) < palmWidth * 1.8);
    if (compactFist) {
      historyRef.current = [];
      // Require the fist to be held for FIST_HOLD_MS before emitting,
      // so a briefly curled hand during a swipe motion doesn't dismiss.
      if (fistStartRef.current === 0) {
        fistStartRef.current = now;
      }
      if (!fistActiveRef.current && now - lastGestureRef.current > COOLDOWN_MS && now - fistStartRef.current >= FIST_HOLD_MS) {
        fistActiveRef.current = true;
        lastGestureRef.current = now;
        emit('fist');
      }
      return;
    }
    fistActiveRef.current = false;
    fistStartRef.current = 0;

    // Navigation requires a clear open hand (four extended fingers).
    // When fingers are only briefly undetected (e.g. during fast motion),
    // keep the swipe history alive so a single tracking glitch doesn't
    // reset the whole swipe gesture.  Only fully clear when the hand is
    // clearly NOT open (fewer than 2 extended fingers).
    if (extendedCount < 4) {
      if (extendedCount < 2) {
        // Clearly not an open hand — reset everything
        historyRef.current = [];
      }
      // Otherwise just skip this frame but keep existing history
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
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) || last.time - first.time > SWIPE_MAX_TIME) return;
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
        else { setLandmarks(null); setDetectionStatus('searching'); historyRef.current = []; fistStartRef.current = 0; }
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
