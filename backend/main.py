from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import json
import logging
import secrets
from html import escape
from google_auth_oauthlib.flow import Flow
from .agent import MoriAgent
from .config import settings
from .gmail_tool import SCOPES, oauth_is_configured, save_credentials
from .intents import classify_intent, wants_sources

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="M.O.R.I. API")
# The same Flow instance holds the PKCE code_verifier generated before the
# browser is sent to Google. It must be reused at the callback; constructing a
# new Flow there causes Google's "Missing code verifier" rejection.
oauth_flows: dict[str, Flow] = {}

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


def _google_flow(state: str | None = None) -> Flow:
    """Create the local OAuth flow without ever handling a Gmail password."""
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
        }
    }
    return Flow.from_client_config(
        client_config, scopes=SCOPES, state=state, redirect_uri=settings.GOOGLE_OAUTH_REDIRECT_URI
    )


@app.get("/api/gmail/oauth/login")
async def gmail_oauth_login():
    if not oauth_is_configured():
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")
    state = secrets.token_urlsafe(32)
    flow = _google_flow(state)
    # Google requires PKCE for this OAuth client. ``Flow`` does not create a
    # verifier automatically, so generate it before the authorization URL and
    # retain the same Flow instance until the callback exchanges the code.
    flow.code_verifier = secrets.token_urlsafe(64)
    oauth_flows[state] = flow
    url, _ = flow.authorization_url(access_type="offline", include_granted_scopes="true", prompt="consent")
    return RedirectResponse(url)


@app.get("/api/gmail/oauth/callback")
async def gmail_oauth_callback(code: str | None = Query(default=None), state: str | None = Query(default=None)):
    if not code or not state or state not in oauth_flows:
        return HTMLResponse("<h2>Google login could not be verified. Please close this window and try again.</h2>", status_code=400)
    flow = oauth_flows.pop(state)
    try:
        flow.fetch_token(code=code)
        save_credentials(flow.credentials)
    except Exception as exc:
        logger.exception("Google OAuth callback failed")
        # Google returns useful configuration codes such as redirect_uri_mismatch
        # here. Show the local user the code, but never log or render secrets.
        detail = escape(str(exc))[:400] or type(exc).__name__
        return HTMLResponse(
            "<h2>Google login failed.</h2>"
            f"<p><code>{detail}</code></p>"
            "<p>Close this window, correct the OAuth setting, then try again.</p>",
            status_code=400,
        )
    origin = json.dumps(settings.FRONTEND_ORIGIN)
    return HTMLResponse(
        f"<script>window.opener?.postMessage({{type:'mori-gmail-connected'}}, {origin});window.close();</script>"
        "<p>Google login completed. You may close this window.</p>"
    )

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
                    if intent and (intent.action == "youtube_search" or (intent.action == "web_search" and wants_sources(content))):
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
                        elif cmd_type == "explainer":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_explainer",
                                "payload": cmd_data,
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
                        elif cmd_type == "gmail":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_gmail",
                                "payload": cmd_data
                            })
                        elif cmd_type == "gmail_auth":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_gmail_auth",
                                "payload": cmd_data
                            })
                        elif cmd_type == "gmail_detail":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "show_gmail_detail",
                                "payload": cmd_data
                            })
                        elif cmd_type == "gmail_opened":
                            await websocket.send_json({
                                "type": "ui_command",
                                "command": "gmail_opened",
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
