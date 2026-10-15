import asyncio
import unittest
from unittest.mock import patch

from backend.agent import MoriAgent
from backend.intents import classify_intent


class AgentIntentTests(unittest.TestCase):
    def setUp(self):
        self.agent = object.__new__(MoriAgent)

    def test_open_youtube_does_not_call_the_llm(self):
        with patch("backend.agent.AsyncGroq") as groq_class:
            result = asyncio.run(self.agent.process_message("YouTubeを開いて"))

        groq_class.assert_not_called()
        self.assertEqual(result["ui_command"]["data"]["mode"], "youtube")

    def test_web_search_is_classified_but_not_a_fixed_action(self):
        """The agent, not the regex router, plans searches that may have later steps."""
        intent = classify_intent("ネットで富士山の天気を調べて")
        self.assertIsNotNone(intent)
        self.assertEqual(intent.action, "web_search")
        self.assertEqual(intent.query, "富士山の天気")


if __name__ == "__main__":
    unittest.main()
