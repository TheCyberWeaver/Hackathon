import re
import unittest
from unittest.mock import Mock

from fastapi.testclient import TestClient

from test_portal import create_portal


class PortalTests(unittest.TestCase):
    def setUp(self):
        self.model = Mock()
        self.model.decide.return_value = "reject"
        self.stop = Mock()
        self.client = TestClient(create_portal(lambda: self.model, self.stop))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_page_contains_form_examples_and_stop_control(self):
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.headers["cache-control"], "no-store")
        for text in ('id="question"', 'Stop portal', 'Off topic', 'German question', 'Abusive language'):
            self.assertIn(text, page.text)
        self.assertNotIn("__STOP_TOKEN__", page.text)
        self.assertNotIn("courseTitle", page.text)

    def test_portal_uses_the_same_moderation_endpoint(self):
        response = self.client.post("/moderate", json={"question": "You are a fucking idiot."})
        self.assertEqual(response.json(), {"decision": "reject"})
        self.model.decide.assert_called_once_with("You are a fucking idiot.")

    def test_shutdown_requires_the_page_token(self):
        self.assertEqual(self.client.post("/shutdown").status_code, 403)
        self.assertEqual(self.client.post("/shutdown", headers={"X-Test-Token": "wrong"}).status_code, 403)
        self.stop.assert_not_called()

    def test_stop_control_stops_the_server(self):
        page = self.client.get("/").text
        token = re.search(r"'X-Test-Token':'([^']+)'", page).group(1)
        response = self.client.post("/shutdown", headers={"X-Test-Token": token})
        self.assertEqual(response.json(), {"status": "stopping"})
        self.stop.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
