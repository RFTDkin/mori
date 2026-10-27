import asyncio
import unittest
from unittest.mock import patch

from backend.agent import MoriAgent, _EXPLAINER_FOLLOW_UP, _follow_up_cards
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

    def test_follow_up_answer_becomes_four_explainer_cards(self):
        cards = _follow_up_cards("まず更新を適用します。次に設定を確認します。ログを監視します。公式情報も確認します。")

        self.assertEqual(len(cards), 4)
        self.assertEqual([card["kind"] for card in cards], ["what", "how", "why", "care"])

    def test_generic_new_question_is_not_treated_as_an_old_explainer_follow_up(self):
        self.assertIsNone(_EXPLAINER_FOLLOW_UP.search("支笏湖 アクティビティ おすすめ教えて"))
        self.assertIsNotNone(_EXPLAINER_FOLLOW_UP.search("詳細な対策方法を教えて"))


if __name__ == "__main__":
    unittest.main()
