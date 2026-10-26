'use client';

import React from 'react';

interface EmailItem {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  date: string;
  preview: string;
  unread: boolean;
}

interface GmailData {
  emails: EmailItem[];
  unread_only: boolean;
  total: number;
  unread_count?: number;
}

interface GmailAuth {
  configured: boolean;
}

interface EmailDetail {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  date: string;
  body: string;
}

export default function GmailDisplay({ data, auth, detail, onClose, onBack, onOpenEmail, onLogin }: {
  data: GmailData | null;
  auth?: GmailAuth | null;
  detail?: EmailDetail | null;
  onClose: () => void;
  onBack: () => void;
  onOpenEmail: (index: number) => void;
  onLogin: () => void;
}) {
  if (auth) {
    return (
      <section className="relative flex h-full w-full max-w-3xl flex-col items-center justify-center overflow-hidden border border-neon-cyan/50 bg-black/90 p-8 text-center shadow-[0_0_30px_rgba(0,240,255,0.16)]">
        <button type="button" onClick={onClose} aria-label="画面を閉じる" className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center border border-neon-cyan/50 text-xl text-neon-cyan hover:bg-neon-cyan hover:text-black">×</button>
        <p className="text-xs font-bold tracking-[0.24em] text-neon-cyan/65">GMAIL // SECURE LINK</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Google アカウントに接続</h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-white/65">
          {auth.configured
            ? 'Googleの安全なログイン画面でアカウントを選択します。パスワードはM.O.R.I.に保存されません。'
            : 'OAuth設定が未完了です。管理者が backend/.env に Google Cloud の Client ID と Client Secret を設定してください。'}
        </p>
        {auth.configured && (
          <button type="button" onClick={onLogin} className="mt-7 border border-neon-cyan bg-neon-cyan/10 px-6 py-3 text-sm font-bold tracking-wider text-neon-cyan transition-colors hover:bg-neon-cyan hover:text-black">
            GOOGLE でログイン
          </button>
        )}
      </section>
    );
  }

  if (!data) return null;
  if (detail) {
    return (
      <section className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border border-neon-cyan/50 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.16)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neon-cyan/30 px-4 py-3">
          <button type="button" onClick={onBack} className="border border-neon-cyan/50 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan hover:text-black">← INBOX</button>
          <button type="button" onClick={onClose} aria-label="画面を閉じる" className="flex h-9 w-9 items-center justify-center border border-neon-cyan/50 text-xl text-neon-cyan hover:bg-neon-cyan hover:text-black">×</button>
        </header>
        <article className="min-h-0 flex-1 overflow-y-auto p-6">
          <p className="text-xs tracking-[0.18em] text-neon-cyan/60">GMAIL // MESSAGE</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{detail.subject}</h2>
          <div className="mt-4 border-y border-neon-cyan/20 py-3 text-sm text-neon-cyan/80">
            <p>{detail.from_name} {detail.from_email && <span className="text-neon-cyan/50">&lt;{detail.from_email}&gt;</span>}</p>
            <p className="mt-1 text-xs text-neon-cyan/50">{detail.date}</p>
          </div>
          <p className="whitespace-pre-wrap break-words py-5 text-sm leading-7 text-white/85">{detail.body}</p>
        </article>
      </section>
    );
  }

  return (
    <section className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border border-neon-cyan/50 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.16)]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-neon-cyan/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-neon-cyan/65">
            GMAIL // INBOX
          </p>
          <h2 className="text-base font-semibold text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>
            {data.unread_only ? '未読メール' : '受信トレイ'}
            <span className="ml-3 text-sm font-normal text-neon-cyan/60">
              {data.total}件
              {data.unread_count !== undefined && data.unread_count > 0 && !data.unread_only && (
                <span className="ml-2 text-neon-magenta">（未読 {data.unread_count}件）</span>
              )}
            </span>
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

      {/* Email List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {data.emails.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-sm text-neon-cyan/60">
              {data.unread_only ? '未読メールはありません。' : 'メールはありません。'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neon-cyan/10">
            {data.emails.map((email, index) => (
              <button
                key={email.id}
                type="button"
                onClick={() => onOpenEmail(index)}
                className={`group relative w-full px-4 py-3 text-left transition-colors hover:bg-neon-cyan/5 ${
                  email.unread ? 'bg-neon-cyan/[0.03]' : ''
                }`}
              >
                {/* Unread indicator */}
                {email.unread && (
                  <div className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-neon-magenta shadow-[0_0_6px_#ff00ff]" />
                )}

                <div className="flex items-start gap-3">
                  {/* Index number */}
                  <span className="mt-0.5 shrink-0 text-xs text-neon-magenta/70 tabular-nums">
                    {index + 1}.
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* From & Date row */}
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`truncate text-sm ${
                          email.unread ? 'font-bold text-neon-cyan' : 'font-medium text-neon-cyan/85'
                        }`}
                      >
                        {email.from_name}
                        {email.from_email && (
                          <span className="ml-1.5 text-xs font-normal text-neon-cyan/40">
                            &lt;{email.from_email}&gt;
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-neon-cyan/50">
                        {email.date}
                      </span>
                    </div>

                    {/* Subject */}
                    <p
                      className={`mt-0.5 truncate text-sm ${
                        email.unread ? 'font-semibold text-white' : 'text-white/80'
                      }`}
                    >
                      {email.subject}
                    </p>

                    {/* Preview */}
                    {email.preview && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
                        {email.preview}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-neon-cyan/20 px-4 py-2">
        <div className="flex items-center justify-between text-[11px] text-neon-cyan/50">
          <span>GMAIL API // OAUTH 2.0</span>
          <span className="text-neon-green/70">音声: 「第1件を読んで」</span>
        </div>
      </footer>
    </section>
  );
}
