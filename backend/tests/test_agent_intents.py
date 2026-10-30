import asyncio
import unittest
from unittest.mock import patch

from backend.agent import MoriAgent, _EXPLAINER_FOLLOW_UP, _RECOMMENDATION_REQUEST, _concise_reply, _follow_up_cards, _result_cards
from backend.intents import classify_intent


class AgentIntentTests(unittest.TestCase):
    def setUp(self):
        self.agent = object.__new__(MoriAgent)

    def test_open_youtube_does_not_call_the_llm(self):
        with patch("backend.agent.AsyncGroq") as groq_class:
            result = asyncio.run(self.agent.process_message("YouTubeを開いて"))

        groq_class.assert_not_called()
        self.assertEqual(result["ui_command"]["data"]["mode"], "youtube")

    def test_youtube_search_bypasses_explainer_cards_and_returns_media(self):
        with patch("backend.agent.execute_tool", return_value={
            "text": "動画を見つけました。",
            "ui_command": {"type": "media", "data": {"mode": "youtube", "results": [{"id": "abc"}]}},
        }) as execute:
            result = asyncio.run(self.agent.process_message("YouTubeで猫動画を調べて"))

        execute.assert_called_once_with("play_youtube", {"query": "猫動画"})
        self.assertEqual(result["ui_command"]["type"], "media")
        self.assertEqual(result["tools_used"], ["play_youtube"])

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

    def test_long_chat_reply_is_trimmed_at_a_sentence_boundary(self):
        text = "短い文です。" + "説明です。" * 100
        reply = _concise_reply(text, limit=80)

        self.assertLessEqual(len(reply), 81)
        self.assertTrue(reply.endswith("。"))

    def test_search_results_become_visual_cards_without_more_searches(self):
        cards = _result_cards([
            {"title": "店 A", "snippet": "駅から近く、焼肉を楽しめます。"},
            {"title": "店 B", "snippet": "予約をおすすめします。"},
        ])

        self.assertEqual([card["title"] for card in cards], ["店 A", "店 B"])
        self.assertEqual([card["kind"] for card in cards], ["what", "how"])

    def test_delicious_restaurant_request_uses_recommendation_flow(self):
        self.assertIsNotNone(_RECOMMENDATION_REQUEST.search("札幌大通り付近においしい焼肉教えて"))
        with patch("backend.agent.execute_tool", return_value={
            "text": "候補を表示します。",
            "ui_command": {"type": "recommendations", "data": {"items": []}},
        }) as execute:
            result = asyncio.run(self.agent.process_message("札幌大通り付近においしい焼肉教えて"))

        execute.assert_called_once_with("get_recommendations", {"query": "札幌大通り付近においしい焼肉教えて"})
        self.assertEqual(result["ui_command"]["type"], "recommendations")


if __name__ == "__main__":
    unittest.main()
