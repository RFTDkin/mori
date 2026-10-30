from typing import List, Dict, Any, Optional
from groq import AsyncGroq
import asyncio
import json
import os
import re
from .config import settings
from .tools import TOOLS_SCHEMA, execute_tool
from .intents import classify_intent, wants_sources


_EXPLAINER_FOLLOW_UP = re.compile(
    # Do not include generic phrases such as 「教えて」or「説明」here.
    # They often introduce a *new* topic (e.g. travel recommendations).
    r"詳細|くわしく|詳しく|対策|どうすれば|どうしたら|予防|安全|危険|影響|手順|対応|もっと深く",
    re.IGNORECASE,
)

_VISUAL_INFORMATION_REQUEST = re.compile(
    r"(?:とは|なに|何|おすすめ|お勧め|教えて|知りたい|調べて|解説|説明|どうして|なぜ|おすすめは)",
    re.IGNORECASE,
)
_RECOMMENDATION_REQUEST = re.compile(
    r"おすすめ|お勧め|おすすめは|推薦|人気.*(?:店|場所|観光|アクティビティ)|(?:おいしい|美味しい).*(?:焼肉|店|レストラン|料理|食べ)",
    re.IGNORECASE,
)


def _concise_reply(text: str, limit: int = 420) -> str:
    """Keep ordinary chat output focused; visual cards carry the extra detail."""
    clean = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(clean) <= limit:
        return clean
    # Finish at the nearest Japanese sentence boundary where possible, rather
    # than cutting a word or Markdown marker in half.
    boundary = max(clean.rfind(mark, 0, limit) for mark in ("。", "！", "？", "\n"))
    return clean[:boundary + 1].rstrip() if boundary >= max(20, limit // 2) else clean[:limit].rstrip() + "…"


def _follow_up_cards(text: str) -> list[Dict[str, str]]:
    """Turn a Japanese follow-up answer into only as many cards as it needs.

    This is deliberately a fallback: it keeps the visual explanation current
    even when the model elects to answer a follow-up directly instead of
    calling ``show_explainer`` again.
    """
    # Model prose can contain Markdown intended for chat. Cards are plain UI
    # text, so remove those markers before displaying it.
    clean = re.sub(r"[*#`]", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    sentences = [item.strip() for item in re.split(r"(?<=[。！？])", clean) if item.strip()]
    if not sentences:
        sentences = ["確認できる情報が不足しています。検索条件を変えてお試しください。"]
    if len(sentences) == 1 and len(clean) > 180:
        # A reply without Japanese sentence punctuation can still be split into
        # readable cards, but never padded to an arbitrary count.
        width = 160
        sentences = [clean[index:index + width] for index in range(0, len(clean), width)]
    labels = ["要点", "補足", "確認事項", "注意点", "追加情報", "まとめ"]
    kinds = ["what", "how", "why", "care", "what", "care"]
    return [
        {"title": labels[index], "kind": kinds[index], "body": body[:160]}
        for index, body in enumerate(sentences[:6])
    ]


def _result_cards(results: List[Dict[str, Any]]) -> list[Dict[str, str]]:
    """Make a useful visual fallback from one completed web search."""
    kinds = ["what", "how", "why", "care", "what", "care"]
    cards = []
    for index, result in enumerate(results[:6]):
        cards.append({
            "title": result.get("title", f"候補 {index + 1}")[:60],
            # Search snippets may be in English. Keep this fallback Japanese;
            # the model-generated explainer provides the translated detail.
            "body": "検索結果の候補です。詳しい内容は下の情報源でご確認ください。",
            "kind": kinds[index],
        })
    return cards or [{
        "title": "検索結果", "body": "候補を取得できませんでした。条件を少し変えてお試しください。", "kind": "what",
    }]


class MoriAgent:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.MODEL_NAME
        self.history = [{"role": "system", "content": settings.SYSTEM_PROMPT}]
        self.gmail_emails: List[Dict[str, Any]] = []
        self.last_explainer_sources: List[Dict[str, Any]] = []
        self.last_explainer_title = ""

    async def process_message(self, user_message: str) -> Dict[str, Any]:
        requested_sources = wants_sources(user_message)
        explainer_follow_up = bool(getattr(self, "last_explainer_sources", []) and _EXPLAINER_FOLLOW_UP.search(user_message))
        latest_search_results: list[Dict[str, Any]] = []
        source_ui_command = None
        is_visual_information_request = bool(_VISUAL_INFORMATION_REQUEST.search(user_message))
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
            # YouTube is a media command, not a general information request.
            # Handle it before the visual-card search fallback below so phrases
            # such as 「YouTubeで〜を調べて」 always return video results.
            if intent.action == "youtube_search":
                tool_result = await asyncio.to_thread(
                    execute_tool, "play_youtube", {"query": intent.query}
                )
                return {**tool_result, "tools_used": ["play_youtube"]}
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

        # Recommendations need a comparison of concrete candidates, not the
        # WHAT/HOW/WHY explainer template. Build source-backed cards directly.
        if not requested_sources and _RECOMMENDATION_REQUEST.search(user_message):
            tool_result = await asyncio.to_thread(execute_tool, "get_recommendations", {"query": user_message})
            return {**tool_result, "tools_used": ["get_recommendations"]}

        # A new explain/recommendation question must not inherit the previous
        # topic's cards. Fetch fresh material up front so a visual answer can
        # still be rendered if the model replies in plain text rather than
        # making a search tool call itself.
        if not requested_sources and not explainer_follow_up and is_visual_information_request:
            prefetched = await asyncio.to_thread(execute_tool, "search_web", {"query": user_message})
            latest_search_results = prefetched.get("ui_command", {}).get("data", {}).get("results", [])

        self.history.append({"role": "user", "content": user_message})
        
        # A recommendation/information request already has one fresh search
        # result. Give the model one turn to synthesize it; do not let it burn
        # every iteration on near-identical re-searches.
        max_iterations = 1 if latest_search_results else 3
        ui_command = None
        tools_used = []

        for i in range(max_iterations):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=self.history,
                    tools=TOOLS_SCHEMA,
                    tool_choice="auto",
                    # List cards can contain every requested item. Leave enough
                    # room for a complete Japanese JSON response.
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
                    if latest_search_results and not requested_sources and ui_command is None and not explainer_follow_up:
                        ui_command = {
                            "type": "explainer",
                            "data": {
                                "title": user_message[:80], "summary": message.content or "検索結果を確認しました。",
                                "cards": _follow_up_cards(message.content or "検索結果を確認しました。"),
                                "sources": latest_search_results[:5],
                            },
                        }
                    if explainer_follow_up and not requested_sources and ui_command is None:
                        ui_command = {
                            "type": "explainer",
                            "data": {
                                "title": f"{getattr(self, 'last_explainer_title', '')}：詳細な対策".strip("："),
                                "summary": (message.content or "詳細な対策を確認してください。")[:320],
                                "cards": _follow_up_cards(message.content or "詳細な対策を確認してください。"),
                                "sources": (latest_search_results or getattr(self, "last_explainer_sources", []))[:5],
                            },
                        }
                    if ui_command and ui_command.get("type") == "explainer":
                        self.last_explainer_sources = ui_command.get("data", {}).get("sources", [])
                        self.last_explainer_title = ui_command.get("data", {}).get("title", "")
                    return {
                        "text": _concise_reply(message.content or "..."),
                        "ui_command": source_ui_command if requested_sources and source_ui_command else ui_command,
                        "tools_used": tools_used
                    }
                
                # Execute tools
                for tool_call in message.tool_calls:
                    func_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments)
                    tools_used.append(func_name)

                    if func_name == "search_web" and latest_search_results and is_visual_information_request:
                        # Use the search performed at the start of this turn.
                        # The model occasionally rephrases the same restaurant
                        # query several times, which only wastes iterations.
                        continue
                    
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
        if latest_search_results and not requested_sources and ui_command is None:
            explainer = {
                "type": "explainer",
                "data": {
                    "title": user_message[:80],
                    "summary": "検索結果から、候補を簡潔にまとめました。",
                    "cards": _result_cards(latest_search_results),
                    "sources": latest_search_results[:5],
                },
            }
            self.last_explainer_sources = latest_search_results[:5]
            self.last_explainer_title = user_message[:80]
            return {
                "text": "候補を表示します。詳細は各カードまたは情報源をご確認ください。",
                "ui_command": explainer,
                "tools_used": tools_used,
            }
        if ui_command is not None:
            if ui_command.get("type") == "explainer":
                self.last_explainer_sources = ui_command.get("data", {}).get("sources", [])
                self.last_explainer_title = ui_command.get("data", {}).get("title", "")
            return {
                "text": "結果を表示します。",
                "ui_command": ui_command,
                "tools_used": tools_used,
            }
        return {
            "text": "思考回数の上限に達しました。",
            "ui_command": ui_command,
            "tools_used": tools_used
        }
