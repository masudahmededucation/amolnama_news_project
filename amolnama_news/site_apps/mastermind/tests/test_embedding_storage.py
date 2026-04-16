"""Tests for varbinary float32 round-trip.

Fast tier: no model loads, no DB. Pure numpy serialization.
"""
import unittest

import numpy as np

from amolnama_news.site_apps.mastermind.embeddings import (
    vector_to_bytes, bytes_to_vector, cosine_similarity,
)


class VectorSerializationTests(unittest.TestCase):

    def test_round_trip_preserves_values(self):
        vector = np.random.rand(384).astype(np.float32)
        binary = vector_to_bytes(vector)
        recovered = bytes_to_vector(binary)
        np.testing.assert_array_equal(vector, recovered)

    def test_list_input_round_trip(self):
        vector_list = [0.1, 0.2, 0.3, 0.4]
        binary = vector_to_bytes(vector_list)
        recovered = bytes_to_vector(binary)
        self.assertEqual(len(recovered), 4)
        np.testing.assert_allclose(recovered, vector_list, rtol=1e-6)

    def test_empty_input_returns_empty_bytes(self):
        self.assertEqual(vector_to_bytes([]), b'')
        self.assertEqual(vector_to_bytes(None), b'')
        self.assertEqual(vector_to_bytes(np.array([], dtype=np.float32)), b'')

    def test_bytes_to_vector_empty(self):
        result = bytes_to_vector(b'')
        self.assertEqual(len(result), 0)
        self.assertEqual(result.dtype, np.float32)

    def test_memoryview_input(self):
        vector = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        binary = vector_to_bytes(vector)
        recovered = bytes_to_vector(memoryview(binary))
        np.testing.assert_array_equal(vector, recovered)

    def test_bytes_to_vector_returns_writable(self):
        """np.frombuffer returns read-only view. We must copy so consumers can mutate."""
        vector = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        recovered = bytes_to_vector(vector.tobytes())
        recovered[0] = 99.0  # Would raise ValueError if read-only
        self.assertEqual(recovered[0], 99.0)

    def test_float64_input_coerced_to_float32(self):
        vector64 = np.array([1.0, 2.0, 3.0], dtype=np.float64)
        binary = vector_to_bytes(vector64)
        self.assertEqual(len(binary), 12)  # 3 floats × 4 bytes


class CosineSimilarityTests(unittest.TestCase):

    def test_identical_vectors_are_one(self):
        vector = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        self.assertAlmostEqual(cosine_similarity(vector, vector), 1.0, places=5)

    def test_orthogonal_vectors_are_zero(self):
        vector_a = np.array([1.0, 0.0], dtype=np.float32)
        vector_b = np.array([0.0, 1.0], dtype=np.float32)
        self.assertAlmostEqual(cosine_similarity(vector_a, vector_b), 0.0, places=5)

    def test_empty_vector_returns_zero(self):
        self.assertEqual(cosine_similarity([], [1.0]), 0.0)
        self.assertEqual(cosine_similarity([1.0], []), 0.0)


if __name__ == '__main__':
    unittest.main()
