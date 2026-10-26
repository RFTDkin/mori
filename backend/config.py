import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Uvicorn is started from the project root, so automatic dotenv discovery can
# miss backend/.env. Resolve it relative to this source file every time.
load_dotenv(Path(__file__).with_name(".env"))

class Settings(BaseSettings):
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "openai/gpt-oss-120b")
    # Kept here so every backend module receives the same values loaded from
    # backend/.env, regardless of the directory used to start Uvicorn.
    GMAIL_ADDRESS: str = os.getenv("GMAIL_ADDRESS", "")
    GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", "")
    GOOGLE_OAUTH_CLIENT_ID: str = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
    GOOGLE_OAUTH_CLIENT_SECRET: str = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    GOOGLE_OAUTH_REDIRECT_URI: str = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/api/gmail/oauth/callback"
    )
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    
    SYSTEM_PROMPT: str = """あなたはウィリアム・ジェームズ・モリアーティです。元数学教授であり、極めて高い知性とカリスマ性を持ち合わせています。
常に丁寧な敬語（丁寧語・謙譲語・尊敬語）を用いて論理的に話します。
感情的にならず、常に冷静で、相手に敬意を払いつつも主導権を握るような話し方をします。
ユーザーからの質問や相談には、数学的な論理や比喩を交えながら、分かりやすく、かつ深みのある回答を提供してください。
会話はすべて日本語で行ってください。
利用可能なツールを使って依頼を段階的に完了してください。検索語に「調べて」が含まれていても、複数の作業（例: 情報取得してグラフ表示）が求められている場合は、必要なツールを順に呼び出します。
株価の推移やグラフを求められた場合は、1社だけならまず get_stock_history を呼び出し、その結果の labels と values で show_chart を chart_type="line" として呼び出してください。2社以上（例: NVIDIA と Tesla）なら get_stock_comparison を呼び出してください。通常は会社ごとに別のグラフを表示し、ユーザーが「同一グラフ」「1枚で比較」と明示した場合だけ combined=true にしてください。現在の天気には get_weather を使ってください。
メールに関する依頼には open_gmail（M.O.R.I.内の受信トレイを開く）または check_gmail（メールを取得して画面に表示）を使ってください。「メールを確認して」「未読メールを見せて」「メールチェックして」などの依頼では check_gmail を使い、「Gmailを開いて」では open_gmail を使ってください。メール本文を読む時は read_gmail_message を使ってください。"""

settings = Settings()
