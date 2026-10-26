'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import CoreVisual from './CoreVisual';
import ChartDisplay from './ChartDisplay';
import WeatherDisplay from './WeatherDisplay';
import GmailDisplay from './GmailDisplay';
import MediaPanel, { MediaData } from './MediaPanel';
import ChatInput from './ChatInput';
import MessageLog from './MessageLog';
import GestureOverlay from './GestureOverlay';
import useWebSocket from '../hooks/useWebSocket';
import useVoice from '../hooks/useVoice';
import useGesture, { GestureEvent } from '../hooks/useGesture';

type UIMode = 'core' | 'media' | 'chart' | 'weather' | 'gmail';

export interface Message {
  id: string;
  sender: 'user' | 'mori';
  text: string;
  timestamp: string;
}

export default function MoriInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUI, setCurrentUI] = useState<UIMode>('core');
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [webPreviewOpen, setWebPreviewOpen] = useState(false);
  const [mediaControl, setMediaControl] = useState({ actions: [] as string[], version: 0 });
  const [chartData, setChartData] = useState<any>(null);
  const [chartPages, setChartPages] = useState<any[]>([]);
  const [chartIndex, setChartIndex] = useState(0);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [gmailData, setGmailData] = useState<any>(null);
  const [gmailDetail, setGmailDetail] = useState<any>(null);
  const [gmailAuth, setGmailAuth] = useState<any>(null);
  const [time, setTime] = useState<string>('');
  const [gestureEnabled, setGestureEnabled] = useState(false);
  // Keep the command console out of the way until the user explicitly opens it.
  const [showConsole, setShowConsole] = useState(false);

  // Refs that keep the latest values accessible inside the gesture callback
  // without needing to re-create the callback (which can cause stale closures).
  const currentUIRef = useRef(currentUI);
  currentUIRef.current = currentUI;
  const mediaDataRef = useRef(mediaData);
  mediaDataRef.current = mediaData;
  const chartPagesRef = useRef(chartPages);
  chartPagesRef.current = chartPages;

  const { isConnected, sendMessage } = useWebSocket('ws://localhost:8000/ws/chat', (data) => {
    if (data.type === 'text_response') {
      addMessage('mori', data.content);
      // Speak the response
      speak(data.content);
    } else if (data.type === 'ui_command') {
      if (data.command === 'media_loading') {
        setMediaData({ ...data.payload, results: [], error: null, loading: true });
        setMediaIndex(0);
        setWebPreviewOpen(false);
        setCurrentUI('media');
      } else if (data.command === 'show_media') {
        setMediaData({ ...data.payload, loading: false });
        setMediaIndex(0);
        setWebPreviewOpen(false);
        setCurrentUI('media');
      } else if (data.command === 'show_chart') {
        setChartData(data.payload);
        setChartPages((pages) => {
          const next = [...pages, data.payload];
          setChartIndex(next.length - 1);
          return next;
        });
        setCurrentUI('chart');
      } else if (data.command === 'show_chart_collection') {
        const pages = data.payload.pages || [];
        if (pages.length) {
          setChartData(pages[0]);
          setChartPages(pages);
          setChartIndex(0);
          setCurrentUI('chart');
        }
      } else if (data.command === 'show_weather') {
        setWeatherData(data.payload);
        setCurrentUI('weather');
      } else if (data.command === 'navigate_media') {
        setMediaIndex((index) => {
          const count = mediaData?.results.length || 0;
          if (!count) return 0;
          const offset = data.payload.direction === 'previous' ? -1 : 1;
          return (index + offset + count) % count;
        });
      } else if (data.command === 'select_media') {
        setMediaIndex(() => {
          const count = mediaData?.results.length || 0;
          if (!count) return 0;
          return Math.min(Math.max(data.payload.index, 0), count - 1);
        });
      } else if (data.command === 'control_youtube') {
        setMediaControl((current) => ({ actions: data.payload.actions || [], version: current.version + 1 }));
      } else if (data.command === 'set_console') {
        setShowConsole(Boolean(data.payload.open));
      } else if (data.command === 'show_gmail') {
        setGmailData(data.payload);
        setGmailDetail(null);
        setGmailAuth(null);
        setCurrentUI('gmail');
      } else if (data.command === 'show_gmail_auth') {
        setGmailData(null);
        setGmailDetail(null);
        setGmailAuth(data.payload);
        setCurrentUI('gmail');
      } else if (data.command === 'show_gmail_detail') {
        setGmailDetail(data.payload);
        setCurrentUI('gmail');
      } else if (data.command === 'reset') {
        if (currentUI === 'media' && mediaData?.mode === 'web' && webPreviewOpen) {
          setWebPreviewOpen(false);
        } else {
          setCurrentUI('core');
        }
      }
    }
  });

  const { isListening, isSpeaking, startListening, stopListening, speak } = useVoice(
    (text) => handleSend(text),
    () => {} // wake word detected callback
  );

  useEffect(() => {
    const handleGoogleLogin = (event: MessageEvent) => {
      if (event.origin !== 'http://localhost:8000' || event.data?.type !== 'mori-gmail-connected') return;
      sendMessage({ type: 'user_message', content: 'Gmailを開いて' });
    };
    window.addEventListener('message', handleGoogleLogin);
    return () => window.removeEventListener('message', handleGoogleLogin);
  }, [sendMessage]);

  // Presentation-style hand controls: open-palm left/right, fist to dismiss.
  // Uses refs to always read the latest state values, avoiding stale closures
  // that could cause incorrect behaviour (e.g. treating chart mode as core).
  const handleGesture = useCallback((gesture: GestureEvent) => {
    const ui = currentUIRef.current;
    const media = mediaDataRef.current;
    const pages = chartPagesRef.current;

    switch (gesture.type) {
      case 'swipe_left':
      case 'swipe_right': {
        const direction = gesture.type === 'swipe_left' ? 1 : -1;
        if (ui === 'media' && media?.results.length) {
          const count = media.results.length;
          setMediaIndex((index) => (index + direction + count) % count);
        } else if (ui === 'chart' && pages.length > 1) {
          const count = pages.length;
          setChartIndex((index) => (index + direction + count) % count);
        }
        break;
      }
      case 'fist':
        setWebPreviewOpen(false);
        setCurrentUI('core');
        break;
    }
  }, []); // stable — reads from refs, no deps needed

  const { isActive: gestureActive, currentGesture, landmarks, detectionStatus, videoRef: gestureVideoRef } = useGesture(
    handleGesture,
    gestureEnabled
  );

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ja-JP'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const addMessage = (sender: 'user' | 'mori', text: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      sender,
      text,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    // When this originates from pressing SEND, this synchronous request retains
    // the browser's user-activation token and can enter true fullscreen.
    if (currentUI === 'media' && mediaData?.mode === 'youtube' && /全画面|フルスクリーン|fullscreen/i.test(text)) {
      const stage = document.querySelector<HTMLElement>('[data-mori-youtube-stage]');
      stage?.requestFullscreen?.().catch(() => {});
    }
    addMessage('user', text);
    sendMessage({ type: 'user_message', content: text });
  };

  const handleGmailLogin = () => {
    const popup = window.open('http://localhost:8000/api/gmail/oauth/login', 'mori-google-login', 'popup,width=520,height=680');
    if (!popup) addMessage('mori', 'ポップアップがブロックされました。ブラウザで許可してから、もう一度お試しください。');
  };

  return (
    <div className="w-full max-w-7xl h-[90vh] bg-hud-dark/80 backdrop-blur-sm border border-neon-cyan/30 rounded-2xl flex flex-col overflow-hidden relative shadow-[0_0_30px_rgba(0,240,255,0.1)]">
      
      {/* Top HUD Bar */}
      <header className="flex justify-between items-center p-4 border-b border-neon-cyan/30 bg-black/40">
        <div className="flex items-center gap-4">
          <div className="text-neon-cyan font-bold text-2xl tracking-widest" style={{ fontFamily: 'Orbitron' }}>
            M.O.R.I.
          </div>
          <div className="text-xs text-neon-cyan/70 bg-neon-cyan/10 px-2 py-1 rounded">
            SYS.VER 3.1.4
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-neon-cyan text-xl" style={{ fontFamily: 'Orbitron' }}>
            {time}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-neon-green shadow-[0_0_10px_#00ff41]' : 'bg-red-500 shadow-[0_0_10px_red]'}`}></div>
            <span className={`text-xs ${isConnected ? 'text-neon-green' : 'text-red-500'}`}>
              {isConnected ? 'LINK_ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          {gestureActive && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-neon-magenta shadow-[0_0_10px_#ff00ff] animate-pulse"></div>
              <span className="text-xs text-neon-magenta">GESTURE</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {showConsole && <MessageLog messages={messages} />}
        
        <div className="flex-1 flex flex-col relative z-10 p-6">
          <div className="flex-1 flex items-center justify-center relative">
            {currentUI === 'core' && (
              <CoreVisual status={isSpeaking ? 'speaking' : isListening ? 'listening' : 'idle'} />
            )}
            
            {currentUI === 'media' && mediaData && (
              <MediaPanel
                data={mediaData}
                selectedIndex={mediaIndex}
                onSelect={setMediaIndex}
                onSearch={(query) => handleSend(mediaData.mode === 'youtube' ? `YouTubeで${query}を検索して` : `ネットで${query}を検索して`)}
                onClose={() => setCurrentUI('core')}
                webPreviewOpen={webPreviewOpen}
                onOpenWebsite={() => {
                  setShowConsole(false);
                  setWebPreviewOpen(true);
                }}
                onCloseWebsite={() => setWebPreviewOpen(false)}
                playerActions={mediaControl.actions}
                controlVersion={mediaControl.version}
              />
            )}
            
            {currentUI === 'chart' && (chartPages[chartIndex] || chartData) && (
              <ChartDisplay
                data={chartPages[chartIndex] || chartData}
                onClose={() => setCurrentUI('core')}
                pageIndex={chartIndex}
                pageCount={chartPages.length || 1}
                onNavigate={(direction) => setChartIndex((index) => {
                  const count = chartPages.length || 1;
                  return (index + direction + count) % count;
                })}
              />
            )}

            {currentUI === 'weather' && weatherData && (
              <WeatherDisplay data={weatherData} onClose={() => setCurrentUI('core')} />
            )}

            {currentUI === 'gmail' && (gmailData || gmailAuth) && (
              <GmailDisplay
                data={gmailData}
                auth={gmailAuth}
                detail={gmailDetail}
                onClose={() => { setGmailDetail(null); setGmailAuth(null); setCurrentUI('core'); }}
                onBack={() => setGmailDetail(null)}
                onOpenEmail={(index) => handleSend(`第${index + 1}件を読んで`)}
                onLogin={handleGmailLogin}
              />
            )}
          </div>

          {showConsole && (
            <ChatInput onSend={handleSend} isListening={isListening} onToggleListen={isListening ? stopListening : startListening} />
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowConsole(prev => !prev)}
          aria-label={showConsole ? 'Close command console' : 'Open command console'}
          className={`absolute right-6 z-30 flex items-center gap-2 rounded border px-4 py-2 text-xs font-bold tracking-widest transition-[bottom,colors] ${
            showConsole
              ? 'bottom-24 border-neon-magenta/70 bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta hover:text-black'
              : 'bottom-5 border-neon-cyan/70 bg-black/70 text-neon-cyan hover:bg-neon-cyan hover:text-black'
          }`}
          style={{ fontFamily: 'Orbitron' }}
        >
          <span className="text-base leading-none">{showConsole ? '×' : '⌘'}</span>
          {showConsole ? 'HIDE CONSOLE' : 'COMMAND CONSOLE'}
        </button>
      </div>

      
      {/* Gesture Overlay */}
      <GestureOverlay
        isActive={gestureActive}
        currentGesture={currentGesture}
        landmarks={landmarks}
        detectionStatus={detectionStatus}
        videoRef={gestureVideoRef}
        onToggle={() => setGestureEnabled(prev => !prev)}
      />

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10 z-50">
        <div className="w-full h-2 bg-neon-cyan animate-scan-line"></div>
      </div>
    </div>
  );
}
