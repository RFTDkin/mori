from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import logging
from .agent import MoriAgent
from .intents import classify_intent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="M.O.R.I. API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    text: str
    ui_command: dict | None = None
    tools_used: list = []

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    agent = MoriAgent()
    result = await agent.process_message(request.message)
    return ChatResponse(**result)

@app.post("/api/tts")
async def tts_endpoint():
    # Placeholder for TTS as frontend uses Web Speech API
    return {"status": "placeholder"}

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    agent = MoriAgent()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                msg_type = payload.get("type")
                content = payload.get("content")
                
                if msg_type in ["text", "audio", "user_message"] and content:
                    intent = classify_intent(content)
                    if intent and intent.action in ("web_search", "youtube_search"):
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": "media_loading",
                            "payload": {
                                "mode": "youtube" if intent.action == "youtube_search" else "web",
                                "query": intent.query,
                            },
                        })

                    result = await agent.process_message(content)
                    
                    # テキスト応答を送信
                    await websocket.send_json({
                        "type": "text_response",
                        "content": result.get("text", "")
                    })
                    
                    # UIコマンドがあれば送信
                    ui_cmd = result.get("ui_command")
                    if ui_cmd:
                        cmd_type = ui_cmd.get("type", "default")
                        cmd_data = ui_cmd.get("data", {})
                        if cmd_type == "video":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_video",
                                "payload": cmd_data
                            })
                        elif cmd_type == "chart":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_chart",
                                "payload": cmd_data
                            })
                        elif cmd_type == "chart_collection":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_chart_collection",
                                "payload": cmd_data
                            })
                        elif cmd_type == "weather":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_weather",
                                "payload": cmd_data
                            })
                        elif cmd_type == "media":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_media",
                                "payload": cmd_data
                            })
                        elif cmd_type == "navigate":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "navigate_media",
                                "payload": cmd_data
                            })
                        elif cmd_type == "select_media":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "select_media",
                                "payload": cmd_data
                            })
                        elif cmd_type == "media_control":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "control_youtube",
                                "payload": cmd_data
                            })
                        elif cmd_type == "console":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "set_console",
                                "payload": cmd_data
                            })
                        elif cmd_type == "default":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "reset",
                                "payload": {}
                            })
                else:
                    await websocket.send_json({"type": "error", "content": "Invalid message format"})
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "content": "Invalid JSON"})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

@app.on_event("startup")
async def startup_event():
    logger.info("M.O.R.I. Backend started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("M.O.R.I. Backend shutting down")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
