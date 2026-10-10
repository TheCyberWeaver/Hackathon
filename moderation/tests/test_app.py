import unittest
from unittest.mock import Mock

from fastapi.testclient import TestClient

from app import create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.moderator = Mock()
        self.moderator.decide.return_value = "accept"
        self.client = TestClient(create_app(lambda: self.moderator))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_minimal_contract_and_trimming(self):
        response = self.client.post("/moderate", json={"question": " Explain BFS? "})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"decision": "accept"})
        self.moderator.decide.assert_called_once_with("Explain BFS?")

    def test_reject_has_no_reason(self):
        self.moderator.decide.return_value = "reject"
        response = self.client.post("/moderate", json={"question": "You are a fucking idiot."})
        self.assertEqual(response.json(), {"decision": "reject"})

    def test_invalid_inputs_never_reach_model(self):
        for body in ({}, {"question": " "},
                     {"question": "x" * 201},
                     {"question": "Explain?", "courseTitle": "Algorithms"},
                     {"question": 42},
                     {"question": "Explain?", "reason": "x"}):
            with self.subTest(body=body):
                self.assertEqual(self.client.post("/moderate", json=body).status_code, 422)
        self.moderator.decide.assert_not_called()

    def test_inference_error_is_unavailable(self):
        self.moderator.decide.side_effect = RuntimeError("private input")
        response = self.client.post("/moderate", json={"question": "Explain?"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private input", response.text)

    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
