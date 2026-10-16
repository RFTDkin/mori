'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';

export interface MediaResult {
  id?: string;
  title: string;
  snippet?: string;
  url?: string;
}

export interface MediaData {
  mode: 'web' | 'youtube';
  query: string;
  results: MediaResult[];
  error: string | null;
  loading?: boolean;
}

interface MediaPanelProps {
  data: MediaData;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSearch: (query: string) => void;
  onClose: () => void;
  webPreviewOpen?: boolean;
  onOpenWebsite?: () => void;
  onCloseWebsite?: () => void;
  playerActions?: string[];
  controlVersion?: number;
}

export default function MediaPanel({ data, selectedIndex, onSelect, onSearch, onClose, webPreviewOpen = false, onOpenWebsite, onCloseWebsite, playerActions = [], controlVersion = 0 }: MediaPanelProps) {
  const [query, setQuery] = useState(data.query);
  const [muted, setMuted] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const selected = data.results[selectedIndex];

  useEffect(() => {
    setQuery(data.query);
  }, [data.query]);

  useEffect(() => {
    // A newly selected video starts safely muted and in the normal panel.
    setMuted(true);
    setTheaterMode(false);
  }, [selected?.id]);

  const unmute = () => {
    setMuted(false);
    playerRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
  };

  const fullscreen = () => {
    const player = playerRef.current;
    if (!player) return;
    player.requestFullscreen?.().catch(() => setTheaterMode(true));
  };

  useEffect(() => {
    if (!playerActions.length) return;
    if (playerActions.includes('unmute')) unmute();
    if (playerActions.includes('fullscreen')) fullscreen();
  // controlVersion changes even when the same instruction is repeated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlVersion]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchQuery = query.trim();
    if (searchQuery) onSearch(searchQuery);
  };

  const moveSelection = (offset: number) => {
    if (!data.results.length) return;
    onSelect((selectedIndex + offset + data.results.length) % data.results.length);
  };

  if (data.mode === 'web' && webPreviewOpen && selected?.url) {
    return (
      <section className="fixed inset-4 z-[70] flex flex-col overflow-hidden border border-neon-cyan/60 bg-black shadow-[0_0_36px_rgba(0,240,255,0.28)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neon-cyan/35 bg-black/95 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-neon-cyan/65">WEBSITE PREVIEW</p>
            <h2 className="truncate text-sm font-semibold text-neon-cyan">{selected.title}</h2>
          </div>
          <button
            type="button"
            onClick={onCloseWebsite}
            aria-label="検索結果に戻る"
            title="検索結果に戻る"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan text-2xl text-neon-cyan transition-colors hover:bg-neon-cyan hover:text-black"
          >
            ×
          </button>
        </header>
        <iframe
          src={selected.url}
          title={selected.title}
          className="min-h-0 flex-1 bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        />
      </section>
    );
  }

  return (
    <section className={`flex h-full w-full flex-col overflow-hidden border border-neon-cyan/50 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.16)] ${theaterMode ? 'fixed inset-0 z-[60] max-w-none' : 'max-h-[min(76vh,760px)] max-w-5xl'}`}>
      <header className="flex items-center justify-between gap-4 border-b border-neon-cyan/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-neon-cyan/65">
            {data.mode === 'youtube' ? 'YOUTUBE // MEDIA' : 'NETWORK // SEARCH'}
          </p>
          <h2 className="truncate text-base font-semibold text-neon-cyan">
            {data.query || (data.mode === 'youtube' ? 'YouTube' : 'ウェブ検索')}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="画面を閉じる"
          title="閉じる"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-cyan/50 text-xl text-neon-cyan transition-colors hover:bg-neon-cyan hover:text-black"
        >
          ×
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2 border-b border-neon-cyan/20 p-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={data.mode === 'youtube' ? 'YouTube検索' : 'ウェブ検索'}
          placeholder={data.mode === 'youtube' ? '動画を検索...' : 'ウェブを検索...'}
          className="min-w-0 flex-1 border border-neon-cyan/35 bg-black px-3 py-2 text-sm text-neon-cyan outline-none placeholder:text-neon-cyan/35 focus:border-neon-cyan"
        />
        <button type="submit" className="border border-neon-cyan px-4 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan hover:text-black">
          検索
        </button>
      </form>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(180px,1fr)_minmax(120px,0.65fr)] gap-3 overflow-y-auto p-3 md:grid-rows-1 md:grid-cols-[minmax(0,1.7fr)_minmax(220px,0.8fr)] md:overflow-hidden">
        <div className="relative flex min-h-[180px] items-center justify-center overflow-hidden border border-neon-cyan/20 bg-black">
          {data.mode === 'youtube' && selected?.id ? (
            <>
              <iframe
                ref={playerRef}
                key={`${selected.id}-${muted}`}
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(selected.id)}?autoplay=1&mute=${muted ? '1' : '0'}&playsinline=1&enablejsapi=1`}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                <button type="button" onClick={unmute} className="border border-neon-cyan/70 bg-black/80 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan hover:text-black">
                  {muted ? 'UNMUTE' : 'SOUND ON'}
                </button>
                <button type="button" onClick={fullscreen} className="border border-neon-cyan/70 bg-black/80 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan hover:text-black">FULLSCREEN</button>
              </div>
            </>
          ) : data.loading ? (
            <p className="animate-pulse px-6 text-center text-sm text-neon-cyan">検索中...</p>
          ) : data.error ? (
            <p className="px-6 text-center text-sm text-red-300">検索に失敗しました: {data.error}</p>
          ) : data.mode === 'youtube' ? (
            <p className="px-6 text-center text-sm text-neon-cyan/60">検索語を入力するか、音声で動画をお申し付けください。</p>
          ) : (
            <p className="px-6 text-center text-sm text-neon-cyan/60">右側の検索結果を選ぶと、ここにウェブサイトを表示します。</p>
          )}
        </div>

        <div className="flex min-h-0 flex-col border-t border-neon-cyan/20 md:border-l md:border-t-0">
          <div className="flex items-center justify-between border-b border-neon-cyan/20 px-2 py-2 text-xs text-neon-cyan/65">
            <span>{data.loading ? '検索中' : `${data.results.length} 件`}</span>
            {data.results.length > 1 && (
              <div className="flex gap-1">
                <button type="button" onClick={() => moveSelection(-1)} aria-label="前の結果" title="前の結果" className="h-7 w-8 border border-neon-cyan/35 text-neon-cyan hover:bg-neon-cyan/15">←</button>
                <button type="button" onClick={() => moveSelection(1)} aria-label="次の結果" title="次の結果" className="h-7 w-8 border border-neon-cyan/35 text-neon-cyan hover:bg-neon-cyan/15">→</button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {data.results.map((result, index) => (
              <button
                key={result.id || result.url || `${result.title}-${index}`}
                type="button"
                onClick={() => {
                  onSelect(index);
                  if (data.mode === 'web') onOpenWebsite?.();
                }}
                className={`block w-full border p-3 text-left transition-colors ${selectedIndex === index ? 'border-neon-cyan/70 bg-neon-cyan/10' : 'border-neon-cyan/15 hover:border-neon-cyan/45'}`}
              >
                <span className="block text-sm font-semibold text-neon-cyan"><span className="mr-2 text-neon-magenta">{index + 1}.</span>{result.title}</span>
                {result.snippet && <span className="mt-1 block line-clamp-3 text-xs leading-5 text-white/65">{result.snippet}</span>}
                {result.url && <span className="mt-2 block truncate text-[11px] text-neon-green/80">{result.url}</span>}
              </button>
            ))}
            {!data.loading && !data.error && data.results.length === 0 && data.query && (
              <p className="p-3 text-sm text-neon-cyan/60">結果がありません。別の語句で検索してください。</p>
            )}
          </div>
          {data.mode === 'web' && selected?.url && (
            <a href={selected.url} target="_blank" rel="noreferrer" className="border-t border-neon-cyan/20 px-3 py-2 text-center text-xs text-neon-green hover:bg-neon-green/10">
              新しいタブで開く ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
