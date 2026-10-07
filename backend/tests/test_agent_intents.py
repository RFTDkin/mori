import asyncio
import unittest
from unittest.mock import patch

from backend.agent import MoriAgent


class AgentIntentTests(unittest.TestCase):
    def setUp(self):
        self.agent = object.__new__(MoriAgent)

    def test_open_youtube_does_not_call_the_llm(self):
        with patch("backend.agent.AsyncGroq") as groq_class:
            result = asyncio.run(self.agent.process_message("YouTubeを開いて"))

        groq_class.assert_not_called()
        self.assertEqual(result["ui_command"]["data"]["mode"], "youtube")

    def test_web_search_executes_directly_without_calling_the_llm(self):
        tool_result = {
            "text": "検索済みの長い本文",
            "ui_command": {
                "type": "media",
                "data": {"mode": "web", "results": [{"title": "結果1"}, {"title": "結果2"}], "error": None},
            },
        }
        with patch("backend.agent.AsyncGroq") as groq_class, patch(
            "backend.agent.execute_tool", return_value=tool_result
        ) as execute_tool:
            result = asyncio.run(self.agent.process_message("ネットで富士山の天気を調べて"))

        groq_class.assert_not_called()
        execute_tool.assert_called_once_with("search_web", {"query": "富士山の天気"})
        self.assertEqual(result["tools_used"], ["search_web"])
        self.assertEqual(result["text"], "検索結果を画面に表示しました。2件見つかりました。")


if __name__ == "__main__":
    unittest.main()