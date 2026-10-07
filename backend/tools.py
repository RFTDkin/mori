from typing import Dict, Any, List
from ddgs import DDGS
import yt_dlp

def search_web_results(query: str) -> Dict[str, Any]:
    """Return structured web search results for the frontend."""
    try:
        results = DDGS().text(query, max_results=5)
        items = [
            {
                "title": result.get("title", "タイトルなし"),
                "snippet": result.get("body", ""),
                "url": result.get("href", ""),
            }
            for result in results or []
        ]
        return {"results": items, "error": None}
    except Exception as e:
        return {"results": [], "error": str(e)}


def format_search_results(response: Dict[str, Any]) -> str:
    if response["error"]:
        return f"検索中にエラーが発生しました: {response['error']}"
    if not response["results"]:
        return "検索結果は見つかりませんでした。"
    return "\n\n".join(
        f"タイトル: {result['title']}\nスニペット: {result['snippet']}\nリンク: {result['url']}"
        for result in response["results"]
    )


def search_web(query: str) -> str:
    """Search the web using DuckDuckGo and format results for the agent."""
    return format_search_results(search_web_results(query))


def play_youtube(query: str) -> Dict[str, Any]:
    """Search YouTube and return video ID for playback."""
    try:
        ydl_opts = {
            'format': 'best',
            'noplaylist': True,
            'quiet': True,
            'extract_flat': True,
            'default_search': 'ytsearch5'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch5:{query}", download=False)
            videos = [
                {"id": video.get("id"), "title": video.get("title", "タイトルなし")}
                for video in (info.get("entries") or [])
                if video.get("id")
            ]
            text = (
                f"YouTubeで「{videos[0]['title']}」など{len(videos)}件を見つけました。"
                if videos
                else "YouTubeで動画が見つかりませんでした。"
            )
            return {
                "text": text,
                "ui_command": {
                    "type": "media",
                    "data": {"mode": "youtube", "query": query, "results": videos, "error": None},
                },
            }
    except Exception as e:
        return {
            "text": f"YouTube検索中にエラーが発生しました: {str(e)}",
            "ui_command": {
                "type": "media",
                "data": {"mode": "youtube", "query": query, "results": [], "error": str(e)},
            },
        }

def show_chart(chart_type: str, title: str, labels: List[str], values: List[float]) -> Dict[str, Any]:
    """Generate chart data for the frontend."""
    return {
        "text": f"「{title}」のグラフを作成しました。",
        "ui_command": {
            "type": "chart",
            "data": {
                "chart_type": chart_type,
                "title": title,
                "labels": labels,
                "values": values
            }
        }
    }

def close_ui() -> Dict[str, Any]:
    """Command to return to default UI state."""
    return {
        "text": "元の画面に戻します。",
        "ui_command": {
            "type": "default",
            "data": {}
        }
    }

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "インターネットで最新の情報を検索します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "検索キーワード"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "play_youtube",
            "description": "YouTubeで動画を検索し、UI上で再生します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "動画の検索キーワード"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_chart",
            "description": "データを基にグラフ（棒グラフ、円グラフなど）をUIに表示します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_type": {
                        "type": "string",
                        "description": "グラフの種類 (例: bar, pie, line)",
                        "enum": ["bar", "pie", "line"]
                    },
                    "title": {
                        "type": "string",
                        "description": "グラフのタイトル"
                    },
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "データラベルの配列"
                    },
                    "values": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "データ値の配列"
                    }
                },
                "required": ["chart_type", "title", "labels", "values"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_ui",
            "description": "特別なUI表示（動画やグラフ）を閉じ、デフォルトの画面に戻します。",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

def execute_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "search_web":
        query = arguments.get("query", "")
        response = search_web_results(query)
        result_text = format_search_results(response)
        return {
            "text": result_text,
            "ui_command": {
                "type": "media",
                "data": {
                    "mode": "web",
                    "query": query,
                    "results": response["results"],
                    "error": response["error"],
                },
            },
        }
    elif name == "play_youtube":
        return play_youtube(arguments.get("query", ""))
    elif name == "show_chart":
        return show_chart(
            arguments.get("chart_type", "bar"),
            arguments.get("title", ""),
            arguments.get("labels", []),
            arguments.get("values", [])
        )
    elif name == "close_ui":
        return close_ui()
    else:
        return {"text": f"不明なツールです: {name}"}
