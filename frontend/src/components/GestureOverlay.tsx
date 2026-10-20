'use client';

import React, { useEffect, useRef } from 'react';
import { GestureType } from '../hooks/useGesture';

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface GestureOverlayProps {
  isActive: boolean;
  currentGesture: GestureType;
  landmarks: HandLandmark[] | null;
  detectionStatus: 'starting' | 'searching' | 'tracking' | 'error';
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggle: () => void;
}

// 手の骨格の接続定義
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // 親指
  [0, 5], [5, 6], [6, 7], [7, 8],       // 人差し指
  [0, 9], [9, 10], [10, 11], [11, 12],  // 中指
  [0, 13], [13, 14], [14, 15], [15, 16],// 薬指
  [0, 17], [17, 18], [18, 19], [19, 20],// 小指
  [5, 9], [9, 13], [13, 17],            // 手のひら横
];

const GESTURE_LABELS: Record<GestureType, string> = {
  cursor_move: '',
  click: '🤏 CLICK',
  double_click: '🤏🤏 DOUBLE CLICK',
  swipe_left: '← NEXT',
  swipe_right: 'PREVIOUS →',
  swipe_up: 'SCROLL ↓',
  swipe_down: 'SCROLL ↑',
  zoom_in: 'ZOOM IN +',
  zoom_out: 'ZOOM OUT −',
  none: '',
};

export default function GestureOverlay({
  isActive,
  currentGesture,
  landmarks,
  detectionStatus,
  videoRef,
  onToggle,
}: GestureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ランドマーク描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 接続線を描画
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.5;

    for (const [start, end] of CONNECTIONS) {
      const s = landmarks[start];
      const e = landmarks[end];
      ctx.beginPath();
      // カメラは左右反転
      ctx.moveTo((1 - s.x) * w, s.y * h);
      ctx.lineTo((1 - e.x) * w, e.y * h);
      ctx.stroke();
    }

    // ランドマーク点を描画
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const isTip = [4, 8, 12, 16, 20].includes(i);

      ctx.beginPath();
      ctx.arc(x, y, isTip ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#ff00ff' : '#00f0ff';
      ctx.fill();

      // 指先にグロー効果
      if (isTip) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
        ctx.fill();
      }
    }
  }, [landmarks]);

  return (
    <div className="absolute bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {/* ジェスチャー通知 */}
      {GESTURE_LABELS[currentGesture] && (
        <div className="px-4 py-2 bg-black/80 border border-neon-magenta rounded text-neon-magenta text-sm font-bold animate-pulse shadow-[0_0_20px_rgba(255,0,255,0.4)]">
          {GESTURE_LABELS[currentGesture]}
        </div>
      )}

      {/* カメラプレビュー + ランドマーク */}
      {isActive && (
        <div className="relative w-40 h-30 border border-neon-cyan/50 rounded overflow-hidden bg-black/60 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          {/* ステータスバー */}
          <div className="absolute top-0 left-0 right-0 bg-black/70 text-[9px] text-neon-green px-1.5 py-0.5 flex items-center gap-1 z-10">
            <div className={`w-1.5 h-1.5 rounded-full ${detectionStatus === 'tracking' ? 'bg-neon-green animate-pulse' : detectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-300 animate-pulse'}`} />
            {detectionStatus === 'tracking' ? 'HAND TRACKING' : detectionStatus === 'error' ? 'CAMERA / MODEL ERROR' : 'HAND SEARCHING'}
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/75 px-1.5 py-1 text-center text-[8px] leading-3 text-neon-cyan/80">
            指差し=カーソル · つまむ=クリック<br />
            両手つまみ=ズーム · 手を払う=移動/スクロール
          </div>

          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-50"
            style={{ transform: 'scaleX(-1)' }}
            autoPlay
            playsInline
            muted
          />

          <canvas
            ref={canvasRef}
            width={160}
            height={120}
            className="absolute inset-0 w-full h-full"
          />

          {/* 手が検出されていない場合 */}
          {!landmarks && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="px-2 text-center text-[10px] text-neon-cyan/80">
                {detectionStatus === 'error' ? '追跡エラー：一度OFF→ONしてください' : '手を明るい場所で中央にかざしてください'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ON/OFF トグルボタン */}
      <button
        onClick={onToggle}
        className={`w-10 h-10 flex items-center justify-center rounded border transition-all ${
          isActive
            ? 'bg-neon-green/20 border-neon-green text-neon-green shadow-[0_0_15px_rgba(0,255,65,0.4)]'
            : 'bg-black/50 border-neon-cyan/30 text-neon-cyan/50 hover:border-neon-cyan hover:text-neon-cyan'
        }`}
        title={isActive ? 'ジェスチャー追跡OFF' : 'ジェスチャー追跡ON'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Hand icon */}
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </button>
    </div>
  );
}
