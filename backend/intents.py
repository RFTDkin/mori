import re
from dataclasses import dataclass
from typing import Literal


IntentAction = Literal[
    "open_youtube",
    "youtube_search",
    "open_search",
    "web_search",
    "close",
    "next",
    "previous",
    "select_media",
    "media_control",
    "console_control",
    "open_gmail",
    "check_gmail",
    "read_gmail",
]

_ORDINAL_WORDS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def _selected_number(message: str) -> int | None:
    """Read common forms such as 「第2個」and「二番目」as a one-based index."""
    match = re.search(r"第?\s*(\d+)\s*(?:個|本|件|通|番目|つ|位|番)", message)
    if match:
        return int(match.group(1))
    match = re.search(r"([一二三四五六七八九十])\s*(?:個|本|件|通|番目|つ|位|番)", message)
    return _ORDINAL_WORDS.get(match.group(1)) if match else None


@dataclass(frozen=True)
class Intent:
    action: IntentAction
    query: str = ""


_YOUTUBE_PATTERN = re.compile(r"youtube|ユーチューブ|ゆーちゅーぶ", re.IGNORECASE)
_WEB_PATTERN = re.compile(r"ネット|インターネット|ウェブ|\bweb\b|検索|調べ|調査|探して", re.IGNORECASE)
_SOURCE_REQUEST_PATTERN = re.compile(
    r"(?:ソース|出典|根拠|原文|リンク|ウェブサイト|サイト|資料|source|sources|reference|references|url|網頁|來源|原文)",
    re.IGNORECASE,
)
_GMAIL_PATTERN = re.compile(
    r"gmail|ジーメール|Gメール|gメール|メール|メイル|mail|email|e-mail|受信トレイ|受信箱|inbox",
    re.IGNORECASE,
)
_GMAIL_CHECK_PATTERN = re.compile(
    r"チェック|確認|見せて|見たい|見て|読んで|読みたい|教えて|取得|表示|一覧|未読|新着|最新|何件|何通|届い|来てる|来てい|ある|check|fetch|show|read",
    re.IGNORECASE,
)
_COMMAND_PATTERN = re.compile(
    r"開いて|開けて|開く|再生してください|再生して|再生|流してください|流して|"
    r"見せて|見たい|検索してください|検索して|検索|調べてください|調べて|調べる|"
    r"調査してください|調査して|調査|確認して|教えてください|教えて|探してください|探して|"
    r"何か|なにか|何を|なにを|とか|など|ください|お願いします|お願い",
    re.IGNORECASE,
)


def _extract_query(message: str) -> str:
    query = _YOUTUBE_PATTERN.sub("", message)
    query = re.sub(r"ネット|インターネット|ウェブ|\bweb\b", "", query, flags=re.IGNORECASE)
    query = _COMMAND_PATTERN.sub("", query)
    query = re.sub(r"^[\s、。:：でをに]+|[\s、。:：でをに]+$", "", query)
    return re.sub(r"\s+", " ", query).strip()


def wants_sources(message: str) -> bool:
    """Whether the user explicitly requested the original web material."""
    return bool(_SOURCE_REQUEST_PATTERN.search(message))


def classify_intent(message: str) -> Intent | None:
    normalized = message.strip().lower()
    if not normalized:
        return None

    if any(phrase in normalized for phrase in ("次へ", "次の結果", "次の動画", "次のページ", "次に進")):
        return Intent("next")
    if any(phrase in normalized for phrase in ("前へ", "前の結果", "前の動画", "前のページ", "ひとつ前", "一つ前")):
        return Intent("previous")
    if any(phrase in normalized for phrase in ("閉じて", "閉めて", "閉じる", "画面を閉", "戻して", "戻って", "画面を消", "終了して")):
        return Intent("close")

    if re.search(r"(?:コンソール|console)\s*(?:オン|on|開)", normalized, re.IGNORECASE):
        return Intent("console_control", "on")
    if re.search(r"(?:コンソール|console)\s*(?:オフ|off|閉)", normalized, re.IGNORECASE):
        return Intent("console_control", "off")

    selected_number = _selected_number(normalized)
    if selected_number and any(phrase in normalized for phrase in ("読んで", "読み上げ", "内容", "本文", "メール")):
        return Intent("read_gmail", str(selected_number - 1))
    if selected_number and any(phrase in normalized for phrase in ("再生", "播放", "流して", "見せて", "選んで")):
        return Intent("select_media", str(selected_number - 1))

    media_actions = []
    # Speech recognition often inserts particles/spaces: 「ミュートを解除」,
    # 「ミュート 解除して」, etc. Treat all of these as the same control.
    if re.search(r"(?:ミュート|消音)\s*(?:を)?\s*解除|音\s*(?:を)?\s*出|音声\s*(?:を)?\s*オン|unmute", normalized, re.IGNORECASE):
        media_actions.append("unmute")
    if any(phrase in normalized for phrase in ("全画面", "フルスクリーン", "fullscreen")):
        media_actions.append("fullscreen")
    if media_actions:
        return Intent("media_control", ",".join(media_actions))

    # Gmail intents – must be checked before web search since "メール" could
    # match the web pattern's "調べ" / "確認" keywords.
    if _GMAIL_PATTERN.search(message):
        if _GMAIL_CHECK_PATTERN.search(message):
            # Determine if the user wants only unread emails.
            unread = bool(re.search(r"未読|新着|unread", normalized))
            return Intent("check_gmail", "unread" if unread else "all")
        return Intent("open_gmail")

    if _YOUTUBE_PATTERN.search(message):
        query = _extract_query(message)
        return Intent("youtube_search" if query else "open_youtube", query)

    if _WEB_PATTERN.search(message):
        query = _extract_query(message)
        return Intent("web_search" if query else "open_search", query)

    return None
