import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

import numpy as np

from moderator import Moderator, normalized_question


class ModeratorTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / "config.json").write_text(json.dumps({"id2label": {"0": "not-toxic", "1": "toxic"}}))
        self.model = Mock()
        self.model.run.return_value = [np.array([[3.0, -3.0]])]
        self.tokenizer = Mock()
        self.tokenizer.encode.return_value = Mock(ids=[101, 42, 102], attention_mask=[1, 1, 1])
        with patch("moderator.model_files", return_value=root), patch("moderator.Tokenizer.from_file", return_value=self.tokenizer), patch("moderator.ort.InferenceSession", return_value=self.model):
            self.moderator = Moderator("unused")
        self.tokenizer.encode.reset_mock()

    def test_non_abusive_question_is_accepted(self):
        for question in ("Why is that the case?", "How do I bake a cake?"):
            self.assertEqual(self.moderator.decide(question), "accept")

    def test_high_toxicity_is_rejected(self):
        self.model.run.return_value = [np.array([[-3.0, 3.0]])]
        self.assertEqual(self.moderator.decide("You are a fucking idiot."), "reject")

    def test_uncertain_toxicity_is_accepted(self):
        self.model.run.return_value = [np.array([[0.0, 1.0]])]
        self.assertEqual(self.moderator.decide("I disagree."), "accept")

    def test_stable_softmax_and_configured_threshold(self):
        self.model.run.return_value = [np.array([[1000.0, 1000.0]])]
        self.assertEqual(self.moderator.decide("Example"), "accept")
        self.moderator.threshold = 0.5
        self.assertEqual(self.moderator.decide("Example"), "reject")

    def test_model_receives_only_question_tokens(self):
        self.moderator.decide("Why?")
        self.tokenizer.encode.assert_called_once_with("Why?")
        inputs = self.model.run.call_args.args[1]
        np.testing.assert_array_equal(inputs["input_ids"], [[101, 42, 102]])
        np.testing.assert_array_equal(inputs["attention_mask"], [[1, 1, 1]])

    def test_obfuscated_abuse_is_normalized_without_changing_harmless_words(self):
        self.assertEqual(normalized_question("f*u*c*k*y*o*u"), "fuck you")
        self.assertEqual(normalized_question("f\u200bu\u200bc\u200bk you"), "fuck you")
        self.assertEqual(normalized_question("How does BFS work?"), "How does BFS work?")
        self.assertEqual(normalized_question("Why is my cat sleeping?"), "Why is my cat sleeping?")

    def test_invalid_output_fails_instead_of_silently_rejecting(self):
        for logits in ([[0.0]], [[0.0, float("nan")]], [[0.0, float("inf")]]):
            with self.subTest(logits=logits), self.assertRaises(ValueError):
                self.model.run.return_value = [np.array(logits)]
                self.moderator.decide("Question")

    def test_invalid_threshold_fails_at_startup(self):
        for value in (float("nan"), float("inf"), -0.1, 1.1):
            with self.subTest(value=value), self.assertRaises(ValueError):
                Moderator("unused", value)


if __name__ == "__main__":
    unittest.main()
