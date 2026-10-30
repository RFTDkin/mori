import unittest
from unittest.mock import patch

from backend.tools import execute_tool


class ExecuteToolTests(unittest.TestCase):
    def test_explainer_keeps_all_list_cards_and_line_breaks(self):
        response = execute_tool("show_explainer", {
            "title": "参加チーム",
            "summary": "16チームです。",
            "cards": [{"title": "入圍賽チーム", "body": "チームA\nチームB", "kind": "list"}] * 7,
        })

        cards = response["ui_command"]["data"]["cards"]
        self.assertEqual(len(cards), 7)
        self.assertEqual(cards[0]["body"], "チームA\nチームB")

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
            "entries": [{"id": "video-1", "title": "動画1", "channel": "チャンネル1"}, {"id": "video-2", "title": "動画2"}]
        }

        response = execute_tool("play_youtube", {"query": "検索語"})

        youtube_dl.extract_info.assert_called_once_with("ytsearch12:検索語", download=False)
        videos = response["ui_command"]["data"]["results"]
        self.assertEqual(len(videos), 2)
        self.assertEqual(videos[1]["id"], "video-2")
        self.assertEqual(videos[0]["channel"], "チャンネル1")
        self.assertEqual(videos[0]["thumbnail"], "https://i.ytimg.com/vi/video-1/hqdefault.jpg")

    @patch("backend.tools._search_images", return_value=["https://images.example/food.jpg"])
    @patch("backend.tools.DDGS")
    def test_recommendations_are_source_backed_cards(self, ddgs_class, _image_search):
        ddgs_class.return_value.text.return_value = [{"title": "店 A", "body": "焼肉店", "href": "https://example.com/a"}]

        response = execute_tool("get_recommendations", {"query": "札幌 焼肉 おすすめ"})

        item = response["ui_command"]["data"]["items"][0]
        self.assertEqual(response["ui_command"]["type"], "recommendations")
        self.assertEqual(item["title"], "店 A")
        self.assertEqual(item["image"], "https://images.example/food.jpg")


if __name__ == "__main__":
    unittest.main()
