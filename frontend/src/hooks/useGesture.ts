'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ジェスチャーの種類
export type GestureType =
  | 'swipe_left'    // 画面を閉じる
  | 'swipe_right'   // メッセージログ表示
  | 'pinch'         // ピンチ操作（音量調整）
  | 'open_hand'     // 停止
  | 'thumbs_up'     // 確認・OK
  | 'none';

export interface GestureEvent {
  type: GestureType;
  confidence: number;
  timestamp: number;
}

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

// 指先とPIP関節のランドマークインデックス
const FINGER_TIPS = [4, 8, 12, 16, 20];       // 親指, 人差し指, 中指, 薬指, 小指
const FINGER_PIPS = [3, 6, 10, 14, 18];       // 各指のPIP関節

// スワイプ検出用の設定
const SWIPE_THRESHOLD = 0.15;     // 移動量の閾値（正規化座標）
const SWIPE_FRAMES = 8;           // 何フレームで判定するか
const GESTURE_COOLDOWN = 1000;    // ジェスチャー間のクールダウン（ms）
const PINCH_THRESHOLD = 0.06;     // ピンチ判定の距離閾値

export default function useGesture(
  onGesture: (gesture: GestureEvent) => void,
  enabled: boolean = false
) {
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onGestureRef = useRef(onGesture);
  const positionHistoryRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastGestureTimeRef = useRef(0);
  const lastPinchValueRef = useRef<number | null>(null);

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  // 指が伸びているかチェック
  const isFingerExtended = useCallback((landmarks: HandLandmark[], fingerIndex: number): boolean => {
    const tipIdx = FINGER_TIPS[fingerIndex];
    const pipIdx = FINGER_PIPS[fingerIndex];

    if (fingerIndex === 0) {
      // 親指は横方向で判定
      return Math.abs(landmarks[tipIdx].x - landmarks[pipIdx].x) > 0.04;
    }
    // 他の指はy座標（上方向が小さい）
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
  }, []);

  // ジェスチャー認識ロジック
  const detectGesture = useCallback((handLandmarks: HandLandmark[]): GestureType => {
    const now = Date.now();

    // クールダウン中は none
    if (now - lastGestureTimeRef.current < GESTURE_COOLDOWN) {
      return 'none';
    }

    const wrist = handLandmarks[0];
    const thumbTip = handLandmarks[4];
    const indexTip = handLandmarks[8];

    // --- ピンチ検出 ---
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    if (pinchDist < PINCH_THRESHOLD) {
      lastGestureTimeRef.current = now;
      lastPinchValueRef.current = pinchDist;
      return 'pinch';
    }

    // --- 全指の状態チェック ---
    const extendedFingers = FINGER_TIPS.map((_, i) => isFingerExtended(handLandmarks, i));
    const extendedCount = extendedFingers.filter(Boolean).length;

    // オープンハンド（パー）: 全指伸ばし
    if (extendedCount >= 4) {
      // スワイプ検出: 手のひらの移動を追跡
      const history = positionHistoryRef.current;
      history.push({ x: wrist.x, y: wrist.y, time: now });

      // 古い履歴を削除
      while (history.length > SWIPE_FRAMES) {
        history.shift();
      }

      if (history.length >= SWIPE_FRAMES) {
        const dx = history[history.length - 1].x - history[0].x;
        const timeDiff = history[history.length - 1].time - history[0].time;

        if (timeDiff < 800 && Math.abs(dx) > SWIPE_THRESHOLD) {
          positionHistoryRef.current = [];
          lastGestureTimeRef.current = now;
          return dx < 0 ? 'swipe_left' : 'swipe_right';
        }
      }

      // スワイプでなければオープンハンド
      if (extendedCount === 5) {
        lastGestureTimeRef.current = now;
        return 'open_hand';
      }
    }

    // サムズアップ: 親指だけ伸ばし
    if (extendedFingers[0] && extendedCount === 1) {
      // 親指が上を向いているか
      if (thumbTip.y < handLandmarks[3].y) {
        lastGestureTimeRef.current = now;
        return 'thumbs_up';
      }
    }

    positionHistoryRef.current.push({ x: wrist.x, y: wrist.y, time: now });
    while (positionHistoryRef.current.length > SWIPE_FRAMES) {
      positionHistoryRef.current.shift();
    }

    return 'none';
  }, [isFingerExtended]);

  // MediaPipe HandLandmarker の初期化
  const initHandLandmarker = useCallback(async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { HandLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      handLandmarkerRef.current = handLandmarker;
      return true;
    } catch (error) {
      console.error('[Gesture] Failed to initialize HandLandmarker:', error);
      return false;
    }
  }, []);

  // カメラ起動
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (error) {
      console.error('[Gesture] Camera access failed:', error);
      return false;
    }
  }, []);

  // フレームごとの検出ループ
  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !handLandmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const results = handLandmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      const hand = results.landmarks[0] as HandLandmark[];
      setLandmarks(hand);

      const gesture = detectGesture(hand);
      if (gesture !== 'none') {
        setCurrentGesture(gesture);
        onGestureRef.current({
          type: gesture,
          confidence: 0.9,
          timestamp: Date.now(),
        });

        // 表示をリセット
        setTimeout(() => setCurrentGesture('none'), 800);
      }
    } else {
      setLandmarks(null);
    }

    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [detectGesture]);

  // 起動・停止
  const start = useCallback(async () => {
    const landmarkerOk = await initHandLandmarker();
    if (!landmarkerOk) return;

    const cameraOk = await startCamera();
    if (!cameraOk) return;

    setIsActive(true);
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [initHandLandmarker, startCamera, detectLoop]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (handLandmarkerRef.current) {
      handLandmarkerRef.current.close();
      handLandmarkerRef.current = null;
    }

    setIsActive(false);
    setLandmarks(null);
    setCurrentGesture('none');
  }, []);

  // enabled プロパティに応じて起動/停止
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive,
    currentGesture,
    landmarks,
    videoRef,
    canvasRef,
    start,
    stop,
  };
}
