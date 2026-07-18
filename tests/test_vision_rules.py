import unittest

from agents.vision import apply_classification_rules


class VisionRulesTest(unittest.TestCase):
    def test_pothole_has_priority_over_other_descriptions(self):
        result = apply_classification_rules(
            "A large crater and broken asphalt on the road surface with a deep hole."
        )
        self.assertEqual(result["issue_type"], "pothole")
        self.assertGreaterEqual(result["confidence"], 0.9)
        self.assertEqual(result["severity"], "high")

    def test_drainage_is_detected_before_garbage(self):
        result = apply_classification_rules(
            "Water islogged on the road and the drain is blocked with sewage overflow."
        )
        self.assertEqual(result["issue_type"], "drainage")

    def test_streetlight_is_detected_when_light_fixture_is_broken(self):
        result = apply_classification_rules(
            "A streetlight pole is broken and the light fixture is missing."
        )
        self.assertEqual(result["issue_type"], "streetlight")


if __name__ == "__main__":
    unittest.main()
