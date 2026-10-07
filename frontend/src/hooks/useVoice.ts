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
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }

      onResultRef.current(resultText);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'aborted') {
        setIsListening(false);
      }
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
      recognition.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synth) return;

    // 再生中の音声を停止
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';

    // 日本語ボイスを探す
    const voices = synth.getVoices();
    const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.includes('ja'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.speak(utterance);
  }, [synth]);

  return { isListening, isSpeaking, startListening, stopListening, speak, transcript };
}
