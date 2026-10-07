from typing import List, Dict, Any, Optional
from groq import AsyncGroq
import asyncio
import json
import os
from .config import settings
from .tools import TOOLS_SCHEMA, execute_tool
from .intents import classify_intent

class MoriAgent:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.MODEL_NAME
        self.history = [{"role": "system", "content": settings.SYSTEM_PROMPT}]

    async def process_message(self, user_message: str) -> Dict[str, Any]:
        intent = classify_intent(user_message)
        if intent:
            if intent.action == "open_youtube":
                return {
                    "text": "YouTube画面を開きました。検索語を入力するか、音声で動画をお申し付けください。",
                    "ui_command": {"type": "media", "data": {"mode": "youtube", "query": "", "results": [], "error": None}},
                    "tools_used": [],
                }
            if intent.action == "open_search":
                return {
                    "text": "検索画面を開きました。検索語を入力するか、音声でお申し付けください。",
                    "ui_command": {"type": "media", "data": {"mode": "web", "query": "", "results": [], "error": None}},
                    "tools_used": [],
                }
            if intent.action == "close":
                return {"text": "画面を閉じました。", "ui_command": {"type": "default", "data": {}}, "tools_used": []}
            if intent.action in ("next", "previous"):
                return {
                    "text": "表示を移動します。",
                    "ui_command": {"type": "navigate", "data": {"direction": intent.action}},
                    "tools_used": [],
                }

            tool_name = "play_youtube" if intent.action == "youtube_search" else "search_web"
            tool_result = await asyncio.to_thread(execute_tool, tool_name, {"query": intent.query})
            if tool_name == "search_web":
                media_data = tool_result.get("ui_command", {}).get("data", {})
                results = media_data.get("results", [])
                error = media_data.get("error")
                if error:
                    tool_result["text"] = f"Web検索に失敗しました: {error}"
                elif results:
                    tool_result["text"] = f"検索結果を画面に表示しました。{len(results)}件見つかりました。"
                else:
                    tool_result["text"] = "検索結果は見つかりませんでした。"
            return {**tool_result, "tools_used": [tool_name]}

        self.history.append({"role": "user", "content": user_message})
        
        max_iterations = 3
        ui_command = None
        tools_used = []

        for i in range(max_iterations):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=self.history,
                    tools=TOOLS_SCHEMA,
                    tool_choice="auto",
                    max_tokens=1024
                )
                
                message = response.choices[0].message
                
                # Append assistant message to history
                message_dict = {"role": message.role}
                if message.content:
                    message_dict["content"] = message.content
                if message.tool_calls:
                    message_dict["tool_calls"] = [
                        {
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        }
                        for tool_call in message.tool_calls
                    ]
                
                self.history.append(message_dict)

                if not message.tool_calls:
                    # No more tool calls, we are done
                    return {
                        "text": message.content or "...",
                        "ui_command": ui_command,
                        "tools_used": tools_used
                    }
                
                # Execute tools
                for tool_call in message.tool_calls:
                    func_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments)
                    tools_used.append(func_name)
                    
                    tool_result = execute_tool(func_name, args)
                    
                    if "ui_command" in tool_result:
                        ui_command = tool_result["ui_command"]
                        
                    self.history.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": func_name,
                        "content": tool_result["text"]
                    })
                    
            except Exception as e:
                return {
                    "text": f"申し訳ありません、エラーが発生しました: {str(e)}",
                    "ui_command": ui_command,
                    "tools_used": tools_used
                }
        
        # If max iterations reached
        return {
            "text": "思考回数の上限に達しました。",
            "ui_command": ui_command,
            "tools_used": tools_used
        }
