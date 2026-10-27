"""Gmail API integration for M.O.R.I. using Google OAuth."""

from __future__ import annotations

import base64
import email.utils
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import settings

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = Path(__file__).with_name("gmail_token.json")


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag in ("style", "script"):
            self.skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script"):
            self.skip = False

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


def oauth_is_configured() -> bool:
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _load_credentials() -> Optional[Credentials]:
    if not TOKEN_PATH.exists():
        return None
    try:
        credentials = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            TOKEN_PATH.write_text(credentials.to_json(), encoding="utf-8")
        return credentials if credentials.valid else None
    except Exception:
        return None


def save_credentials(credentials: Credentials) -> None:
    """Persist only the OAuth refresh token for this local M.O.R.I. instance."""
    TOKEN_PATH.write_text(credentials.to_json(), encoding="utf-8")


def _auth_required_response() -> Dict[str, Any]:
    if not oauth_is_configured():
        return {
            "text": "Google OAuthの設定がまだ完了していません。",
            "ui_command": {"type": "gmail_auth", "data": {"configured": False}},
        }
    return {
        "text": "Googleでログインすると、M.O.R.I.内で受信トレイを表示できます。",
        "ui_command": {"type": "gmail_auth", "data": {"configured": True}},
    }


def _gmail_service():
    credentials = _load_credentials()
    return build("gmail", "v1", credentials=credentials, cache_discovery=False) if credentials else None


def _header(message: Dict[str, Any], name: str) -> str:
    for header in message.get("payload", {}).get("headers", []):
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def _date(raw: str) -> str:
    try:
        return email.utils.parsedate_to_datetime(raw).astimezone().strftime("%m/%d %H:%M")
    except Exception:
        return raw


def _sender(raw: str) -> tuple[str, str]:
    name, address = email.utils.parseaddr(raw)
    return name or address or raw, address


def _decode_body(data: str) -> str:
    try:
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    except Exception:
        return ""


def _body(payload: Dict[str, Any]) -> str:
    """Prefer plain text, then make an HTML-only message readable."""
    plain: list[str] = []
    html: list[str] = []

    def visit(part: Dict[str, Any]) -> None:
        data = part.get("body", {}).get("data")
        if data:
            content = _decode_body(data)
            if part.get("mimeType") == "text/plain":
                plain.append(content)
            elif part.get("mimeType") == "text/html":
                html.append(content)
        for child in part.get("parts", []):
            visit(child)

    visit(payload)
    if plain:
        return "\n".join(plain).strip()
    if html:
        parser = _HTMLTextExtractor()
        parser.feed("\n".join(html))
        return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    return ""


def open_gmail() -> Dict[str, Any]:
    """Open the user's full Gmail inbox instead of a truncated API preview.

    Gmail deliberately prevents its authenticated UI from being embedded in an
    iframe.  Sending a navigation command lets the browser load the official
    inbox as a normal top-level page, with every message and Gmail feature
    available.  ``check_gmail`` remains available for concise in-app previews.
    """
    return {
        "text": "Gmailを開きます。",
        "ui_command": {
            "type": "gmail_opened",
            "data": {"url": "https://mail.google.com/mail/u/0/#inbox"},
        },
    }


def check_gmail(count: int = 10, unread_only: bool = False) -> Dict[str, Any]:
    if not oauth_is_configured() or not _load_credentials():
        return _auth_required_response()
    try:
        service = _gmail_service()
        if service is None:
            return _auth_required_response()
        query = "is:unread" if unread_only else None
        result = service.users().messages().list(
            userId="me", labelIds=["INBOX"], q=query, maxResults=max(1, min(count, 30))
        ).execute()
        emails: List[Dict[str, Any]] = []
        for ref in result.get("messages", []):
            message = service.users().messages().get(
                userId="me", id=ref["id"], format="metadata", metadataHeaders=["From", "Subject", "Date"]
            ).execute()
            sender_name, sender_email = _sender(_header(message, "From"))
            emails.append({
                "id": message["id"], "from_name": sender_name, "from_email": sender_email,
                "subject": _header(message, "Subject") or "（件名なし）", "date": _date(_header(message, "Date")),
                "preview": message.get("snippet", ""), "unread": "UNREAD" in message.get("labelIds", []),
            })
        unread = service.users().messages().list(userId="me", labelIds=["INBOX"], q="is:unread", maxResults=1).execute()
        unread_count = unread.get("resultSizeEstimate", 0)
        return {
            "text": f"{len(emails)}件の{'未読メール' if unread_only else 'メール'}を取得しました。",
            "ui_command": {"type": "gmail", "data": {
                "emails": emails, "unread_only": unread_only, "total": len(emails), "unread_count": unread_count,
            }},
        }
    except Exception:
        return _auth_required_response()


def read_gmail_message(message_id: str) -> Dict[str, Any]:
    if not oauth_is_configured() or not _load_credentials():
        return _auth_required_response()
    try:
        service = _gmail_service()
        if service is None:
            return _auth_required_response()
        message = service.users().messages().get(userId="me", id=message_id, format="full").execute()
        sender_name, sender_email = _sender(_header(message, "From"))
        detail = {
            "id": message_id, "from_name": sender_name, "from_email": sender_email,
            "subject": _header(message, "Subject") or "（件名なし）", "date": _date(_header(message, "Date")),
            "body": _body(message.get("payload", {}))[:12000] or "（本文をテキストとして取得できませんでした。）",
        }
        return {"text": f"「{detail['subject']}」を表示します。", "ui_command": {"type": "gmail_detail", "data": detail}}
    except Exception:
        return {"text": "メール本文を取得できませんでした。もう一度Googleでログインしてください。"}
