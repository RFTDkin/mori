from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone
import json
from urllib.parse import quote
from urllib.request import Request, urlopen
from ddgs import DDGS
import yt_dlp
from .gmail_tool import open_gmail, check_gmail, read_gmail_message


def _get_json(url: str) -> Dict[str, Any]:
    """Fetch a public JSON endpoint without requiring the user to enter an API key."""
    request = Request(url, headers={"User-Agent": "MORI graduation-project assistant/1.0"})
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))

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


def get_weather(location: str) -> Dict[str, Any]:
    """Return current weather from Open-Meteo using a human-readable place name."""
    try:
        places = _get_json(
            "https://geocoding-api.open-meteo.com/v1/search?name="
            f"{quote(location)}&count=1&language=ja&format=json"
        ).get("results", [])
        if not places:
            return {"text": f"「{location}」の場所を見つけられませんでした。"}

        place = places[0]
        weather = _get_json(
            "https://api.open-meteo.com/v1/forecast?latitude="
            f"{place['latitude']}&longitude={place['longitude']}"
            "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m"
            "&timezone=auto"
        ).get("current", {})
        code = weather.get("weather_code")
        descriptions = {
            0: "快晴", 1: "晴れ", 2: "晴れ時々くもり", 3: "くもり", 45: "霧", 48: "霧氷",
            51: "弱い霧雨", 53: "霧雨", 55: "強い霧雨", 61: "弱い雨", 63: "雨", 65: "強い雨",
            71: "弱い雪", 73: "雪", 75: "大雪", 80: "にわか雨", 81: "にわか雨", 82: "激しいにわか雨",
            95: "雷雨", 96: "ひょうを伴う雷雨", 99: "激しいひょうを伴う雷雨",
        }
        name = place.get("name", location)
        admin = place.get("admin1")
        label = f"{name}（{admin}）" if admin and admin != name else name
        temperature = weather.get("temperature_2m")
        condition = descriptions.get(code, "観測情報")
        text = f"{label}の現在の天気は{condition}、気温は{temperature}℃です。"
        return {
            "text": text,
            "ui_command": {
                "type": "weather",
                "data": {
                    "location": label,
                    "temperature": temperature,
                    "apparent_temperature": weather.get("apparent_temperature"),
                    "humidity": weather.get("relative_humidity_2m"),
                    "wind_speed": weather.get("wind_speed_10m"),
                    "condition": condition,
                    "observed_at": weather.get("time"),
                },
            },
        }
    except Exception as e:
        return {"text": f"天気情報の取得に失敗しました: {str(e)}"}


def get_stock_history(symbol: str, days: int = 30) -> Dict[str, Any]:
    """Get daily closing prices from Yahoo Finance's public chart endpoint."""
    try:
        points = _get_stock_points(symbol, days)
        if not points:
            return {"text": f"{symbol.upper()}の有効な終値データを取得できませんでした。"}
        labels, values = zip(*points)
        payload = {"symbol": symbol.upper(), "labels": list(labels), "values": list(values)}
        return {
            "text": (
                f"{symbol.upper()}の直近{len(points)}営業日の終値データです。"
                "グラフ表示が必要な依頼では、次にshow_chartをline形式で呼び出してください。\n"
                + json.dumps(payload, ensure_ascii=False)
            )
        }
    except Exception as e:
        return {"text": f"株価データの取得に失敗しました: {str(e)}"}


def _get_stock_points(symbol: str, days: int) -> List[tuple[str, float]]:
    """Return dated daily closes; shared by the single-stock and comparison tools."""
    days = max(1, min(int(days), 365))
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days + 14)
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{quote(symbol.upper())}?period1={int(start.timestamp())}&period2={int(end.timestamp())}&interval=1d"
    )
    result = _get_json(url).get("chart", {}).get("result", [])
    if not result:
        return []
    series = result[0]
    timestamps = series.get("timestamp") or []
    closes = (series.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    return [
        (datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%m/%d"), round(float(close), 2))
        for timestamp, close in zip(timestamps, closes)
        if close is not None
    ][-days:]


def get_stock_comparison(symbols: List[str], days: int = 30, combined: bool = False) -> Dict[str, Any]:
    """Create separate charts by default, or one multi-line comparison on request."""
    try:
        unique_symbols = list(dict.fromkeys(symbol.upper().strip() for symbol in symbols if symbol.strip()))[:5]
        if len(unique_symbols) < 2:
            return {"text": "比較には2つ以上の銘柄が必要です。"}
        point_sets = {symbol: _get_stock_points(symbol, days) for symbol in unique_symbols}
        if any(not points for points in point_sets.values()):
            missing = ", ".join(symbol for symbol, points in point_sets.items() if not points)
            return {"text": f"次の銘柄の株価データを取得できませんでした: {missing}"}

        # Compare only dates traded by all companies, so each point shares one x-axis.
        common_dates = set.intersection(*(set(date for date, _ in points) for points in point_sets.values()))
        labels = [date for date, _ in point_sets[unique_symbols[0]] if date in common_dates]
        labels = labels[-max(1, min(int(days), 365)):]
        series = []
        for symbol in unique_symbols:
            by_date = dict(point_sets[symbol])
            series.append({"name": symbol, "values": [by_date[date] for date in labels]})
        if not labels:
            return {"text": "共通する取引日を見つけられませんでした。"}
        if not combined:
            pages = [
                {
                    "chart_type": "line",
                    "title": f"{item['name']}：直近{len(labels)}営業日の終値",
                    "labels": labels,
                    "values": item["values"],
                }
                for item in series
            ]
            return {
                "text": f"{', '.join(unique_symbols)}の株価グラフを{len(pages)}枚に分けて表示しました。",
                "ui_command": {"type": "chart_collection", "data": {"pages": pages}},
            }

        title = f"{' vs '.join(unique_symbols)}：直近{len(labels)}営業日の終値"
        return {
            "text": f"{', '.join(unique_symbols)}の株価比較グラフを表示しました。",
            "ui_command": {
                "type": "chart",
                "data": {
                    "chart_type": "line",
                    "title": title,
                    "labels": labels,
                    "values": series[0]["values"],
                    "series": series,
                },
            },
        }
    except Exception as e:
        return {"text": f"株価比較データの取得に失敗しました: {str(e)}"}

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
            "name": "read_gmail_message",
            "description": "指定したIDのGmail本文をM.O.R.I.画面に表示します。",
            "parameters": {
                "type": "object",
                "properties": {"message_id": {"type": "string", "description": "IMAPメールID"}},
                "required": ["message_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_comparison",
            "description": "2社以上の株価を取得して表示します。通常は会社ごとに別々のグラフを表示します。「同じグラフで比較」「1枚のグラフ」と明示された場合だけ combined=true にします。Tesla=TSLA、NVIDIA=NVDA。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbols": {"type": "array", "items": {"type": "string"}, "description": "比較するティッカーの配列。例: [\"NVDA\", \"TSLA\"]"},
                    "days": {"type": "integer", "description": "直近営業日数。例: 30"},
                    "combined": {"type": "boolean", "description": "同一グラフに重ねて比較する時だけ true。通常は false。"},
                },
                "required": ["symbols", "days"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "指定した都市・地域の現在の天気を取得して画面に表示します。最新の天気を尋ねられた時に使います。",
            "parameters": {
                "type": "object",
                "properties": {"location": {"type": "string", "description": "都市名または地域名"}},
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_history",
            "description": "株式銘柄の終値履歴を取得します。株価の推移・期間指定・グラフ依頼に使います。Tesla は TSLA を使用します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "株式ティッカー。例: TSLA, AAPL, 7203.T"},
                    "days": {"type": "integer", "description": "取得する直近営業日数。例: 30"},
                },
                "required": ["symbol", "days"],
            },
        },
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
    },
    {
        "type": "function",
        "function": {
            "name": "open_gmail",
            "description": "M.O.R.I.内のGmail受信トレイを開きます。ユーザーが「Gmailを開いて」「メールを開いて」と言った時に使います。",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_gmail",
            "description": "Gmailの受信トレイからメールを取得して画面に表示します。「メールをチェックして」「未読メールを見せて」「メール確認して」などの依頼に使います。",
            "parameters": {
                "type": "object",
                "properties": {
                    "count": {
                        "type": "integer",
                        "description": "取得するメール件数（1〜30）。デフォルトは10。"
                    },
                    "unread_only": {
                        "type": "boolean",
                        "description": "未読メールのみ取得する場合はtrue。デフォルトはfalse。"
                    }
                }
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
    elif name == "get_weather":
        return get_weather(arguments.get("location", ""))
    elif name == "get_stock_history":
        return get_stock_history(arguments.get("symbol", ""), arguments.get("days", 30))
    elif name == "get_stock_comparison":
        return get_stock_comparison(arguments.get("symbols", []), arguments.get("days", 30), arguments.get("combined", False))
    elif name == "close_ui":
        return close_ui()
    elif name == "open_gmail":
        return open_gmail()
    elif name == "check_gmail":
        return check_gmail(arguments.get("count", 10), arguments.get("unread_only", False))
    elif name == "read_gmail_message":
        return read_gmail_message(arguments.get("message_id", ""))
    else:
        return {"text": f"不明なツールです: {name}"}
