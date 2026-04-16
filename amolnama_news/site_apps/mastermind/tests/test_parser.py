"""Tests for _parse_llm_response — LLM JSON extraction.

Fast tier: no model loads, no DB. Safe to run anytime.
"""
import unittest

from amolnama_news.site_apps.mastermind.ai_generator import _parse_llm_response


class ParseLlmResponseTests(unittest.TestCase):
    """Cover every shape of LLM output we've seen or expect."""

    def test_clean_json_array(self):
        response = '[{"question":"ক?","options":[],"is_correct":true}]'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['question'], 'ক?')

    def test_json_wrapped_in_markdown_fence(self):
        response = '```json\n[{"question":"ক?"}]\n```'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertEqual(len(result), 1)

    def test_json_wrapped_in_plain_fence(self):
        response = '```\n[{"question":"ক?"}]\n```'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertEqual(len(result), 1)

    def test_json_with_trailing_comma_array(self):
        response = '[{"question":"ক?"},]'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)

    def test_json_with_trailing_comma_object(self):
        response = '[{"question":"ক?","extra":1,}]'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNotNone(result)

    def test_no_json_returns_none(self):
        response = 'Sorry, I cannot generate questions for this text.'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNone(result)

    def test_malformed_json_returns_none(self):
        response = '[{"question":"ক?","options":[{unclosed'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNone(result)

    def test_json_object_not_array_returns_none(self):
        response = '{"question":"ক?"}'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNone(result)

    def test_preamble_text_before_json(self):
        response = 'Here are the questions:\n[{"question":"ক?"}]'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertEqual(len(result), 1)

    def test_llm_puts_answer_in_label_field_parses_ok(self):
        """Regression: parser accepts weird label field. Store layer must not trust it."""
        response = '[{"question":"ক?","options":[{"label":"ঢাকাস্থ বাংলাদেশ","text":"ঢাকা","is_correct":true}]}]'
        result = _parse_llm_response(response, 'mcq_single')
        self.assertIsNotNone(result)
        # Parser does NOT sanitize — downstream store layer must derive label from index.
        self.assertEqual(result[0]['options'][0]['label'], 'ঢাকাস্থ বাংলাদেশ')


if __name__ == '__main__':
    unittest.main()
