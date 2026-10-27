from typing import List, Dict, Any, Optional
from groq import AsyncGroq
import asyncio
import json
import os
import re
from .config import settings
from .tools import TOOLS_SCHEMA, execute_tool
from .intents import classify_intent, wants_sources

class MoriAgent:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.MODEL_NAME
        self.history = [{"role": "system", "content": settings.SYSTEM_PROMPT}]
        self.gmail_emails: List[Dict[str, Any]] = []

    async def process_message(self, user_message: str) -> Dict[str, Any]:
        requested_sources = wants_sources(user_message)
        latest_search_results: list[Dict[str, Any]] = []
        source_ui_command = None
        # Make multi-stock chart requests deterministic: the display must retain
        # one chart per company unless the user explicitly asks for one combined chart.
        normalized = user_message.lower()
        company_aliases = {
            "TSLA": ("tesla", "テスラ"),
            "NVDA": ("nvidia", "エヌビディア", "エヌビディア"),
            "AAPL": ("apple", "アップル"),
            "MSFT": ("microsoft", "マイクロソフト"),
        }
        symbols = [symbol for symbol, aliases in company_aliases.items() if any(alias in normalized for alias in aliases)]
        if len(symbols) >= 2 and any(word in user_message for word in ("株価", "株", "グラフ", "chart")):
            days_match = re.search(r"(\d+)\s*日", user_message)
            days = int(days_match.group(1)) if days_match else 30
            combined = any(phrase in normalized for phrase in ("同一グラフ", "同じグラフ", "1枚のグラフ", "一枚のグラフ", "比較して"))
            tool_result = await asyncio.to_thread(
                execute_tool,
                "get_stock_comparison",
                {"symbols": symbols, "days": days, "combined": combined},
            )
            return {**tool_result, "tools_used": ["get_stock_comparison"]}

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
            if intent.action == "select_media":
                number = int(intent.query) + 1
                return {
                    "text": f"{number}番目の動画を再生します。",
                    "ui_command": {"type": "select_media", "data": {"index": int(intent.query)}},
                    "tools_used": [],
                }
            if intent.action == "media_control":
                actions = intent.query.split(",")
                descriptions = {"unmute": "ミュートを解除", "fullscreen": "全画面表示"}
                return {
                    "text": "、".join(descriptions[action] for action in actions) + "します。",
                    "ui_command": {"type": "media_control", "data": {"actions": actions}},
                    "tools_used": [],
                }
            if intent.action == "console_control":
                is_open = intent.query == "on"
                return {
                    "text": "コマンドコンソールを開きます。" if is_open else "コマンドコンソールを閉じます。",
                    "ui_command": {"type": "console", "data": {"open": is_open}},
                    "tools_used": [],
                }
            if intent.action == "open_gmail":
                tool_result = await asyncio.to_thread(execute_tool, "open_gmail", {})
                self.gmail_emails = tool_result.get("ui_command", {}).get("data", {}).get("emails", [])
                return {**tool_result, "tools_used": ["open_gmail"]}
            if intent.action == "check_gmail":
                unread_only = intent.query == "unread"
                tool_result = await asyncio.to_thread(
                    execute_tool, "check_gmail", {"count": 10, "unread_only": unread_only}
                )
                self.gmail_emails = tool_result.get("ui_command", {}).get("data", {}).get("emails", [])
                return {**tool_result, "tools_used": ["check_gmail"]}
            if intent.action == "read_gmail":
                index = int(intent.query)
                if not self.gmail_emails:
                    return {
                        "text": "先に「Gmailを開いて」または「メールを確認して」とお申し付けください。",
                        "ui_command": None,
                        "tools_used": [],
                    }
                if index < 0 or index >= len(self.gmail_emails):
                    return {"text": f"{index + 1}番目のメールは表示されていません。", "ui_command": None, "tools_used": []}
                tool_result = await asyncio.to_thread(
                    execute_tool, "read_gmail_message", {"message_id": self.gmail_emails[index]["id"]}
                )
                return {**tool_result, "tools_used": ["read_gmail_message"]}

            # Searches can be part of a larger request (for example, research then
            # graph the result). Let the LLM plan those multi-step requests instead
            # of short-circuiting them with a keyword rule.

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
                    # Explainer tool calls contain four cards. Leave enough
                    # room for a complete JSON call rather than truncating it.
                    max_tokens=2048
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
                    if latest_search_results and not requested_sources and ui_command is None:
                        ui_command = {
                            "type": "explainer",
                            "data": {
                                "title": user_message[:80], "summary": message.content or "検索結果を確認しました。",
                                "cards": [{"title": "要点", "body": message.content or "検索結果を確認しました。", "kind": "what"}],
                                "sources": latest_search_results[:5],
                            },
                        }
                    return {
                        "text": message.content or "...",
                        "ui_command": source_ui_command if requested_sources and source_ui_command else ui_command,
                        "tools_used": tools_used
                    }
                
                # Execute tools
                for tool_call in message.tool_calls:
                    func_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments)
                    tools_used.append(func_name)
                    
                    # Network-backed tools must not freeze the WebSocket event loop.
                    tool_result = await asyncio.to_thread(execute_tool, func_name, args)
                    
                    if func_name == "search_web":
                        latest_search_results = tool_result.get("ui_command", {}).get("data", {}).get("results", [])
                        if requested_sources:
                            source_ui_command = tool_result.get("ui_command")
                    elif "ui_command" in tool_result:
                        ui_command = tool_result["ui_command"]
                        if func_name == "show_explainer" and latest_search_results:
                            ui_command["data"]["sources"] = latest_search_results[:5]
                        
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
