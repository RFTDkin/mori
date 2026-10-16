import unittest

from backend.intents import classify_intent


class ClassifyIntentTests(unittest.TestCase):
    def test_opens_youtube_without_a_query(self):
        self.assertEqual(classify_intent("YouTubeを開いて").action, "open_youtube")

    def test_extracts_youtube_search_query(self):
        intent = classify_intent("YouTubeで米津玄師の曲を流して")
        self.assertEqual((intent.action, intent.query), ("youtube_search", "米津玄師の曲"))

    def test_extracts_web_search_query(self):
        intent = classify_intent("ネットで富士山の天気を調べて")
        self.assertEqual((intent.action, intent.query), ("web_search", "富士山の天気"))

    def test_opens_search_screen_without_a_query(self):
        self.assertEqual(classify_intent("ネットで何か調べて").action, "open_search")

    def test_combined_youtube_and_web_request_does_not_search_for_filler(self):
        intent = classify_intent("YouTubeとかネットで何かを調べて")
        self.assertEqual((intent.action, intent.query), ("open_youtube", ""))

    def test_recognizes_media_navigation_and_close(self):
        self.assertEqual(classify_intent("次の動画へ").action, "next")
        self.assertEqual(classify_intent("検索画面を閉じて").action, "close")

    def test_selects_a_numbered_video(self):
        intent = classify_intent("第3個を再生して")
        self.assertEqual((intent.action, intent.query), ("select_media", "2"))

    def test_recognizes_combined_youtube_controls(self):
        intent = classify_intent("再生している動画のミュート解除と全画面にして")
        self.assertEqual((intent.action, intent.query), ("media_control", "unmute,fullscreen"))

    def test_recognizes_unmute_as_a_standalone_control(self):
        intent = classify_intent("再生している動画のミュートを解除して")
        self.assertEqual((intent.action, intent.query), ("media_control", "unmute"))


if __name__ == "__main__":
    unittest.main()
