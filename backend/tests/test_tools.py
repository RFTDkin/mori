import unittest
from unittest.mock import patch

from backend.tools import execute_tool


class ExecuteToolTests(unittest.TestCase):
    @patch("backend.tools.DDGS")
    def test_web_search_returns_displayable_results_from_one_search(self, ddgs_class):
        ddgs_class.return_value.text.return_value = [
            {"title": "結果", "body": "概要", "href": "https://example.com"}
        ]

        response = execute_tool("search_web", {"query": "検索語"})

        ddgs_class.assert_called_once_with()
        ddgs_class.return_value.text.assert_called_once_with("検索語", max_results=5)
        self.assertEqual(response["ui_command"]["type"], "media")
        self.assertEqual(response["ui_command"]["data"]["results"][0]["url"], "https://example.com")

    @patch("backend.tools.yt_dlp.YoutubeDL")
    def test_youtube_search_returns_multiple_selectable_videos(self, youtube_dl_class):
        youtube_dl = youtube_dl_class.return_value.__enter__.return_value
        youtube_dl.extract_info.return_value = {
            "entries": [{"id": "video-1", "title": "動画1"}, {"id": "video-2", "title": "動画2"}]
        }

        response = execute_tool("play_youtube", {"query": "検索語"})

        youtube_dl.extract_info.assert_called_once_with("ytsearch5:検索語", download=False)
        self.assertEqual(response["ui_command"]["data"]["results"][1]["id"], "video-2")


if __name__ == "__main__":
    unittest.main()