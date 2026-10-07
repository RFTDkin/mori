# M.O.R.I. - Tactical AI Command

> **M**oriarty **O**perations **R**esearch **I**nterface

サイバーパンクHUDスタイルのAI音声アシスタント「モリ」— ウィリアム・ジェームズ・モリアーティのペルソナを持つ、インテリジェントな対話型AIエージェント。

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────┐
│          Frontend (Next.js)          │
│  ┌─────────┐ ┌──────┐ ┌──────────┐  │
│  │CoreVisual│ │Video │ │ Chart    │  │
│  │ (HUD)   │ │Player│ │ Display  │  │
│  └─────────┘ └──────┘ └──────────┘  │
│  ┌─────────────────────────────────┐ │
│  │     ChatInput + Voice (STT/TTS) │ │
│  └─────────────────────────────────┘ │
│            ↕ WebSocket               │
├─────────────────────────────────────┤
│          Backend (FastAPI)           │
│  ┌──────────────────────────┐       │
│  │    MoriAgent (LLM Loop)  │       │
│  │  ┌──────┐ ┌───────────┐  │       │
│  │  │Tools │ │ Groq API  │  │       │
│  │  └──────┘ └───────────┘  │       │
│  └──────────────────────────┘       │
└─────────────────────────────────────┘
```

## 🚀 セットアップ

### 前提条件
- **Node.js** 18+
- **Python** 3.10+
- **Groq API Key** ([https://console.groq.com](https://console.groq.com) で取得)

### 1. Groq API Keyの設定

```bash
# backend/.env を編集
GROQ_API_KEY=your_actual_api_key_here
MODEL_NAME=openai/gpt-oss-120b
```

### 2. バックエンドのセットアップ

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### 3. フロントエンドのセットアップ

```bash
cd frontend
npm install
```

### 4. 起動

**一括起動（推奨）:**
```bash
# プロジェクトルートの start_mori.bat をダブルクリック
```

**個別起動:**

```bash
# ターミナル1: バックエンド
cd backend
.\venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# ターミナル2: フロントエンド
cd frontend
npm run dev
```

### 5. アクセス
- **フロントエンド**: [http://localhost:3000](http://localhost:3000)
- **バックエンドAPI**: [http://localhost:8000](http://localhost:8000)
- **APIドキュメント**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🎯 機能

| 機能 | 説明 |
|------|------|
| 🗣️ 音声対話 | Web Speech APIによる日本語STT/TTS |
| 🔊 ウェイクワード | 「モリ」「モリアーティ」で起動 |
| ⚡ バージイン | ユーザー発話検知で即座にTTS停止 |
| 🌐 Web検索 | DuckDuckGoによるリアルタイム検索 |
| 🎬 YouTube再生 | 画面内での動画埋め込み再生 |
| 📊 データ可視化 | 動的なグラフ生成・表示 |
| 🤖 エージェントループ | 最大3回のツール呼び出し自律実行 |
| 🎨 サイバーパンクUI | ネオン・HUDスタイルのインターフェース |

## 🛠️ 技術スタック

- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS
- **Backend**: Python / FastAPI / WebSocket
- **AI**: Groq API (openai/gpt-oss-120b)
- **Tools**: DuckDuckGo Search / yt-dlp
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)
