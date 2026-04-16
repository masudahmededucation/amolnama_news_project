"""Regression test for the NVARCHAR(5) option_label truncation bug.

Fast tier: no model, no DB. Just validates the label derivation logic
we expect _store_generated_questions() to apply.
"""
import unittest


BENGALI_OPTION_LABELS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ']


def derive_option_label(option_index):
    """Mirror the logic inside _store_generated_questions."""
    if option_index < len(BENGALI_OPTION_LABELS):
        return BENGALI_OPTION_LABELS[option_index]
    return str(option_index + 1)


class OptionLabelDerivationTests(unittest.TestCase):

    def test_first_four_options_get_bengali_letters(self):
        self.assertEqual(derive_option_label(0), 'ক')
        self.assertEqual(derive_option_label(1), 'খ')
        self.assertEqual(derive_option_label(2), 'গ')
        self.assertEqual(derive_option_label(3), 'ঘ')

    def test_fifth_option_gets_bengali_letter(self):
        self.assertEqual(derive_option_label(4), 'ঙ')

    def test_sixth_option_falls_back_to_number(self):
        self.assertEqual(derive_option_label(5), '6')

    def test_labels_fit_within_nvarchar_5(self):
        """Every generated label must be <=5 chars to fit NVARCHAR(5)."""
        for option_index in range(20):
            label = derive_option_label(option_index)
            self.assertLessEqual(
                len(label), 5,
                f"Label at index {option_index} is too long: {label!r}",
            )

    def test_labels_are_unique_per_index(self):
        labels = [derive_option_label(i) for i in range(5)]
        self.assertEqual(len(labels), len(set(labels)))


if __name__ == '__main__':
    unittest.main()
