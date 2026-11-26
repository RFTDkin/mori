'use client';

import React, { useMemo, useState } from 'react';

export interface RecommendationItem { title: string; snippet?: string; url: string; image?: string; }
export interface RecommendationData { query: string; items: RecommendationItem[]; error?: string | null; }

export default function RecommendationDisplay({ data, onClose, onOpen }: {
  data: RecommendationData; onClose: () => void; onOpen: (item: RecommendationItem) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItem = data.items[selectedIndex];
  const mapQuery = selectedItem ? `${selectedItem.title} ${data.query}` : data.query;
  const mapUrl = useMemo(
    () => `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`,
    [mapQuery]
  );
  return (
    <section className="flex h-full w-full max-h-[min(76vh,760px)] max-w-7xl flex-col overflow-hidden border border-neon-green/50 bg-black/90 shadow-[0_0_30px_rgba(0,255,65,0.14)]">
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
        <div className="min-h-0 space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item, index) => (
                <article
                  key={item.url || `${item.title}-${index}`}
                  className={`group overflow-hidden border bg-white/[0.03] text-left transition-colors ${
                    selectedIndex === index
                      ? 'border-neon-green bg-neon-green/[0.08] shadow-[0_0_16px_rgba(0,255,65,0.14)]'
                      : 'border-neon-green/30 hover:border-neon-green hover:bg-neon-green/[0.08]'
                  }`}
                >
                  <button type="button" onClick={() => setSelectedIndex(index)} className="block w-full text-left" aria-pressed={selectedIndex === index}>
                  {item.image ? (
                    <img src={item.image} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-neon-green/15 to-black text-xs tracking-[0.2em] text-neon-green/60">画像なし</div>
                  )}
                  <span className="block p-4">
                    <span className="text-xs font-bold tracking-[0.15em] text-neon-green/70">候補 {index + 1}</span>
                    <span className="mt-2 block line-clamp-2 text-base font-semibold leading-6 text-white">{item.title}</span>
                    {item.snippet && <span className="mt-2 block line-clamp-3 text-sm leading-5 text-white/65">{item.snippet}</span>}
                    <span className="mt-4 block text-xs text-neon-green">地図で見る</span>
                  </span>
                  </button>
                  <button type="button" onClick={() => onOpen(item)} className="mx-4 mb-4 border border-neon-green/50 px-3 py-1.5 text-xs text-neon-green hover:bg-neon-green hover:text-black">
                    店舗情報を開く ↗
                  </button>
                </article>
              ))}
            </div>
            {!data.items.length && <p className="py-16 text-center text-sm text-neon-green/70">候補を取得できませんでした。条件を変えてお試しください。</p>}
          <aside className="min-h-[360px] overflow-hidden border border-neon-green/35 bg-black">
            <div className="flex items-center justify-between border-b border-neon-green/25 px-3 py-2 text-xs text-neon-green/80">
              <span className="font-bold tracking-[0.16em]">周辺マップ</span>
              <span className="max-w-[65%] truncate text-white/50">{selectedItem?.title || data.query}</span>
            </div>
            <iframe
              src={mapUrl}
              title={`${selectedItem?.title || data.query} の地図`}
              className="h-[360px] w-full border-0 sm:h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
