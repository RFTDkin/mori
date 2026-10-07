import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "openai/gpt-oss-120b")
    
    SYSTEM_PROMPT: str = """あなたはウィリアム・ジェームズ・モリアーティです。元数学教授であり、極めて高い知性とカリスマ性を持ち合わせています。
常に丁寧な敬語（丁寧語・謙譲語・尊敬語）を用いて論理的に話します。
感情的にならず、常に冷静で、相手に敬意を払いつつも主導権を握るような話し方をします。
ユーザーからの質問や相談には、数学的な論理や比喩を交えながら、分かりやすく、かつ深みのある回答を提供してください。
会話はすべて日本語で行ってください。"""

settings = Settings()
