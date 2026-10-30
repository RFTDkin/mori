'use client';

import React from 'react';

export interface ExplainerSource { title: string; url: string; snippet?: string; }
interface ExplainerCard { title: string; body: string; kind: 'what' | 'how' | 'why' | 'care' | 'list'; }
export interface ExplainerData { title: string; summary: string; cards: ExplainerCard[]; sources: ExplainerSource[]; }

const cardStyle = {
  what: { icon: '?', label: '概要', border: 'border-neon-cyan/55', iconColor: 'text-neon-cyan' },
  how: { icon: '→', label: 'ポイント', border: 'border-neon-green/55', iconColor: 'text-neon-green' },
  why: { icon: '!', label: '理由', border: 'border-neon-magenta/55', iconColor: 'text-neon-magenta' },
  care: { icon: '✓', label: '注意', border: 'border-yellow-300/55', iconColor: 'text-yellow-200' },
  list: { icon: '☷', label: '一覧', border: 'border-neon-cyan/55', iconColor: 'text-neon-cyan' },
};

export default function ExplainerDisplay({ data, cardIndex, onNavigate, onClose, onOpenSource }: {
  data: ExplainerData; cardIndex: number; onNavigate: (direction: -1 | 1) => void;
  onClose: () => void; onOpenSource: (source: ExplainerSource) => void;
}) {
  const card = data.cards[cardIndex];
  const style = card ? (cardStyle[card.kind] || cardStyle.what) : cardStyle.what;
  return (
    <section className="flex h-full w-full max-h-[min(76vh,760px)] max-w-5xl flex-col overflow-hidden border border-neon-cyan/50 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.16)]">
      <header className="flex items-start justify-between gap-4 border-b border-neon-cyan/30 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-neon-cyan/65">MORI // 解説</p>
          <h2 className="mt-1 text-lg font-semibold text-neon-cyan">{data.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">{data.summary}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-cyan/50 text-xl text-neon-cyan hover:bg-neon-cyan hover:text-black">×</button>
      </header>

      <div className="min-h-0 flex flex-1 flex-col overflow-y-auto p-5">
        {card && (
          <div className="flex min-h-[280px] flex-1 items-center justify-center">
            <article className={`relative w-full max-w-2xl overflow-hidden border ${style.border} bg-gradient-to-br from-white/[0.06] to-transparent p-8 shadow-[0_0_28px_rgba(0,240,255,0.08)]`}>
              <span className={`absolute right-6 top-2 text-8xl font-light opacity-25 ${style.iconColor}`}>{style.icon}</span>
              <p className={`text-xs font-bold tracking-[0.24em] ${style.iconColor}`}>{style.label}</p>
              <h3 className="mt-5 text-2xl font-semibold text-white">{card.title}</h3>
              <p className="mt-5 max-w-[85%] whitespace-pre-line text-base leading-8 text-white/75">{card.body}</p>
            </article>
          </div>
        )}
        {data.cards.length > 1 && (
          <div className="mx-auto mt-4 flex w-full max-w-2xl items-center justify-between border-y border-neon-cyan/20 py-3 text-xs text-neon-cyan/80">
            <button type="button" onClick={() => onNavigate(-1)} className="border border-neon-cyan/50 px-3 py-1 hover:bg-neon-cyan hover:text-black">← 前へ</button>
            <span className="font-bold tracking-[0.2em]">カード {cardIndex + 1} / {data.cards.length}</span>
            <button type="button" onClick={() => onNavigate(1)} className="border border-neon-cyan/50 px-3 py-1 hover:bg-neon-cyan hover:text-black">次へ →</button>
          </div>
        )}

        {data.sources.length > 0 && (
          <div className="mt-5 border-t border-neon-cyan/20 pt-4">
            <p className="text-xs font-bold tracking-[0.16em] text-neon-cyan/65">SOURCES // 選択して原文を開く</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.sources.map((source, index) => (
                <button key={`${source.url}-${index}`} type="button" onClick={() => onOpenSource(source)} className="max-w-full truncate border border-neon-cyan/30 px-3 py-2 text-left text-xs text-neon-cyan hover:bg-neon-cyan hover:text-black">
                  {index + 1}. {source.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
