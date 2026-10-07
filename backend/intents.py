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
]


@dataclass(frozen=True)
class Intent:
    action: IntentAction
    query: str = ""


_YOUTUBE_PATTERN = re.compile(r"youtube|ユーチューブ|ゆーちゅーぶ", re.IGNORECASE)
_WEB_PATTERN = re.compile(r"ネット|インターネット|ウェブ|\bweb\b|検索|調べ|調査|探して", re.IGNORECASE)
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

    if _YOUTUBE_PATTERN.search(message):
        query = _extract_query(message)
        return Intent("youtube_search" if query else "open_youtube", query)

    if _WEB_PATTERN.search(message):
        query = _extract_query(message)
        return Intent("web_search" if query else "open_search", query)

    return None