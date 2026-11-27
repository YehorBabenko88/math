"""Developer draft checks; not independently sealed U fixtures."""
import unittest
from decimal import Decimal as D
from unittest.mock import patch
from math_research_paper import Observation, Funding, evaluate_closed_quote

class AdmissionTests(unittest.TestCase):
    def args(self):
        return dict(side='long', entry=Observation(10,10,D('100')),
                    exit=Observation(20,20,D('110')), decision_ms=9,
                    as_of_ms=21, notional=D('200'), fee_bps=D('10'),
                    slippage_bps=D('0'), funding=(), funding_status='COMPLETE',
                    coverage_status='COMPLETE',
                    decision_features=(Observation(7,8,D('99')),))

    def test_delegates_once(self):
        with patch('math_research_paper.paper_quote_metrics') as kernel:
            self.assertIs(evaluate_closed_quote(**self.args()), kernel.return_value)
            kernel.assert_called_once_with('long',D('100'),D('110'),D('200'),D('10'),D('0'),())

    def test_refusals(self):
        for change in (dict(funding_status='UNKNOWN'), dict(coverage_status='PARTIAL'),
                       dict(exit=Observation(20,22,D('110'))),
                       dict(funding=(Funding(15,22,D('100'),D('.01')),)),
                       dict(funding=(Funding(15,15,D('100'),D('.01')),)*2)):
            with self.subTest(change=change), patch('math_research_paper.paper_quote_metrics') as kernel:
                with self.assertRaises(ValueError):
                    evaluate_closed_quote(**(self.args() | change))
                kernel.assert_not_called()

    def test_decision_features_refuse_future_and_equal_time(self):
        for feature in (Observation(7,10,D('99')), Observation(7,9,D('99')),
                        Observation(8,7,D('99')), Observation(7,8,D('NaN'))):
            with self.subTest(feature=feature), patch('math_research_paper.paper_quote_metrics') as kernel:
                with self.assertRaises(ValueError):
                    evaluate_closed_quote(**(self.args() | {'decision_features': (feature,)}))
                kernel.assert_not_called()

    def test_exact_long_and_short_costs(self):
        # Developer expectations for zero slippage, quantity=2 and one funding event.
        # These are not U's independently sealed vectors.
        args = self.args() | {'funding': (Funding(20,21,D('100'),D('.01')),)}
        long = evaluate_closed_quote(**args)
        self.assertEqual(tuple(long)[7:], (D('.42'), D('2'), D('17.58')))
        short = evaluate_closed_quote(**(args | {'side':'short',
                                                 'exit':Observation(20,20,D('90'))}))
        self.assertEqual(tuple(short)[7:], (D('.38'), D('-2'), D('21.62')))

    def test_funding_boundary_refusal(self):
        for row in (Funding(10,10,D('100'),D('.01')),
                    Funding(21,21,D('100'),D('.01')),
                    Funding(20,22,D('100'),D('.01'))):
            with self.subTest(row=row), patch('math_research_paper.paper_quote_metrics') as kernel:
                with self.assertRaises(ValueError):
                    evaluate_closed_quote(**(self.args() | {'funding':(row,)}))
                kernel.assert_not_called()
