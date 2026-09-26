import unittest

from app.services.evaluations_service import EvaluationService


class TestASGFormula(unittest.TestCase):

    def test_ambit_score_uses_equal_indicator_weights(self):
        scores = [6.0, 8.0, 10.0]

        result = EvaluationService.calculate_ambit_score(scores)

        self.assertEqual(result, 8.0)

    def test_global_score_uses_equal_ambit_weights(self):
        ambit_scores = [6.0, 8.0, 10.0]

        result = EvaluationService.calculate_global_score(
            ambit_scores
        )

        self.assertEqual(result, 8.0)

    def test_global_score_is_independent_of_indicator_count(self):
        environmental = EvaluationService.calculate_ambit_score(
            [10.0] * 15
        )
        social = EvaluationService.calculate_ambit_score(
            [8.0] * 10
        )
        governance = EvaluationService.calculate_ambit_score(
            [6.0] * 5
        )

        result = EvaluationService.calculate_global_score(
            [
                environmental,
                social,
                governance
            ]
        )

        self.assertEqual(result, 8.0)

    def test_ambit_score_rejects_empty_scores(self):
        with self.assertRaises(ValueError):
            EvaluationService.calculate_ambit_score([])

    def test_global_score_rejects_empty_ambits(self):
        with self.assertRaises(ValueError):
            EvaluationService.calculate_global_score([])


if __name__ == "__main__":
    unittest.main()
