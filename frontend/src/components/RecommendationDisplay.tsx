'use client';

import React from 'react';

export interface RecommendationItem { title: string; snippet?: string; url: string; image?: string; }
export interface RecommendationData { query: string; items: RecommendationItem[]; error?: string | null; }

export default function RecommendationDisplay({ data, onClose, onOpen }: {
  data: RecommendationData; onClose: () => void; onOpen: (item: RecommendationItem) => void;
}) {
  return (
    <section className="flex h-full w-full max-h-[min(76vh,760px)] max-w-6xl flex-col overflow-hidden border border-neon-green/50 bg-black/90 shadow-[0_0_30px_rgba(0,255,65,0.14)]">
      <header className="flex items-start justify-between gap-4 border-b border-neon-green/30 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-neon-green/70">MORI // RECOMMENDATIONS</p>
          <h2 className="mt-1 text-lg font-semibold text-neon-green">{data.query}</h2>
          <p className="mt-1 text-xs text-white/60">候補を選ぶと、根拠となる店舗・施設情報を開きます。</p>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-green/50 text-xl text-neon-green hover:bg-neon-green hover:text-black">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {data.error && <p className="mb-4 text-sm text-yellow-200">一部の検索先に接続できませんでした。表示中の情報は開く前にご確認ください。</p>}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item, index) => (
            <button key={item.url || `${item.title}-${index}`} type="button" onClick={() => onOpen(item)} className="group overflow-hidden border border-neon-green/30 bg-white/[0.03] text-left hover:border-neon-green hover:bg-neon-green/[0.08]">
              {item.image ? (
                <img src={item.image} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-neon-green/15 to-black text-xs tracking-[0.2em] text-neon-green/60">IMAGE UNAVAILABLE</div>
              )}
              <span className="block p-4">
                <span className="text-xs font-bold tracking-[0.15em] text-neon-green/70">CANDIDATE {index + 1}</span>
                <span className="mt-2 block line-clamp-2 text-base font-semibold leading-6 text-white">{item.title}</span>
                {item.snippet && <span className="mt-2 block line-clamp-3 text-sm leading-5 text-white/65">{item.snippet}</span>}
                <span className="mt-4 block text-xs text-neon-green">SOURCE ↗</span>
              </span>
            </button>
          ))}
        </div>
        {!data.items.length && <p className="py-16 text-center text-sm text-neon-green/70">候補を取得できませんでした。条件を変えてお試しください。</p>}
      </div>
    </section>
  );
}
