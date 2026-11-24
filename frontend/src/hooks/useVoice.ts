'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function useVoice(onResult: (text: string) => void, onWakeWord: () => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  const onResultRef = useRef(onResult);
  const onWakeWordRef = useRef(onWakeWord);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  // コールバック参照を最新に保つ
  useEffect(() => {
    onResultRef.current = onResult;
    onWakeWordRef.current = onWakeWord;
  }, [onResult, onWakeWord]);

  // isListening の ref を同期
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // SpeechRecognition の初期化（一度だけ）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const resultText = event.results[current][0].transcript;
      setTranscript(resultText);

      // ウェイクワード検出
      if (resultText.includes('モリ') || resultText.includes('モリアーティ')) {
        onWakeWordRef.current();
      }

      // バージイン: TTS再生中にユーザーが話したら停止
      window.speechSynthesis?.cancel();
      ttsAbortRef.current?.abort();
      audioRef.current?.pause();

      onResultRef.current(resultText);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.error('Speech recognition error', event.error);
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      // リスニング中なら自動再起動
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition', e);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      recognition.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      isListeningRef.current = true;
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        isListeningRef.current = false;
        console.error(e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synth) return;

    // Stop both the ElevenLabs playback and browser fallback first.
    synth.cancel();
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

    const speakWithBrowser = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      const jaVoice = synth.getVoices().find(v => v.lang === 'ja-JP' || v.lang.includes('ja'));
      if (jaVoice) utterance.voice = jaVoice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      synth.speak(utterance);
    };

    const controller = new AbortController();
    ttsAbortRef.current = controller;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    void fetch(`${backendUrl}/api/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`TTS unavailable (${response.status})`);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); speakWithBrowser(); };
      await audio.play();
    }).catch((error: unknown) => {
      if ((error as DOMException).name !== 'AbortError') speakWithBrowser();
    });
  }, [synth]);

  return { isListening, isSpeaking, startListening, stopListening, speak, transcript };
}
