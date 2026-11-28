"""P31: real C ACF and Scientific Memory; no database or second kernel."""
from decimal import Decimal, localcontext
from fractions import Fraction
from hashlib import sha256
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
from history_timeseries import acf
from history_statistics import project_decimal_observations
from scientific_memory import build_record, canonical, decode_record, digest, qualify_historical_record


def make(values, operator='at_most', threshold='-0.5'):
    with localcontext() as ctx:
        ctx.prec = 128
        closes = [Decimal('10')]
        for value in values:
            closes.append(closes[-1] + Decimal(value))
    rows = [[str(i*60000), p, p, p, p, '1.0000', '1.00']
            for i, close in reversed(list(enumerate(closes, 1)))
            for p in [format(close, 'f')]]
    return build_record('BTCUSDT', rows, digest(rows), operator, threshold)


def oracle(values):
    xs = list(map(Fraction, values))
    centered = [len(xs)*x-sum(xs) for x in xs]
    den = sum(z*z for z in centered)
    return [Fraction(1)] + [sum(centered[i]*centered[i-h] for i in range(h, len(xs)))/den
                             for h in (1, 2)]


# Immutable synthetic X11 record from P30, not regenerated with the new kernel.
LEGACY = '{"algorithm":"math.history.acf.v1","dataset":{"end_ms":360000,"id":"4797f781207f7cd244bdec7d6154f63e1c102e70ba2d67095718530659a8362c","interval":"1m","rows":6,"sha256":"26b385e34a8ede8bab6a8a8582d4bf2bc518bcfeae75e5898e25c9a3d5bbd4af","source":"https://api.bybit.com/v5/market/kline","start_ms":60000,"symbol":"BTCUSDT","time_encoding":"unix_ms_utc"},"id":"a70718796dbe084f17eba6a912243d58c1d8a4c9b7b60afeda5fb72cd429a98f","input_hash":"26b385e34a8ede8bab6a8a8582d4bf2bc518bcfeae75e5898e25c9a3d5bbd4af","parameters":{"claim_lag":1,"claim_operator":"at_most","claim_threshold":"-0.5","input":"consecutive_close_deltas","max_lag":2},"provenance":{"admission":"pinned_input_not_exchange_completeness_attestation","collector":"Grid","compute_owner":"Math","execution_authority":false,"provider":"Bybit","scope":"descriptive_observations_only","trading_authorized":false},"reproducibility":{"observations":5,"projection":"DECIMAL_TO_BINARY64_V1","reference":"direct_rational_acf"},"result":{"absolute_error":["0","221/270","23/45"],"acf":[1.0,0.0,0.0],"decision_basis":"exact_reference_lag_1","error_encoding":"exact_fraction","exact_reference":["1","-221/270","23/45"]},"schema":"math.scientific-memory.record.v1","space":"time_series","status":"reproduced","symbol":"BTCUSDT"}'
SMALL = ['0.00000000000000000001', '-0.00000000000000000001',
         '0.00000000000000000002', '-0.00000000000000000002', '0.00000000000000000001']


class ScientificMemoryProjectionP31(unittest.TestCase):
    def assert_record(self, record, values):
        ref = oracle(values)
        represented = oracle([Fraction(float(Decimal(v))) for v in values])
        self.assertEqual(record['result']['exact_reference'], list(map(str, ref)))
        self.assertEqual(record['result']['acf'], list(map(float, represented)))
        self.assertEqual(record['result']['absolute_error'],
                         [str(abs(Fraction(x)-r)) for x, r in zip(record['result']['acf'], ref)])
        q = qualify_historical_record(record)
        self.assertEqual(q['source_authenticity'], 'UNATTESTED')
        self.assertIs(q['execution_authority'], False)
        self.assertIs(q['trading_authorized'], False)

    def test_reject_all_distinct_decimals_collapsing_to_one_float(self):
        values = ['1.00000000000000000000', '1.00000000000000000001']*2
        self.assertEqual(project_decimal_observations(list(map(Decimal, values))), (1.,)*4)
        with self.assertRaisesRegex(ValueError, 'ACF_PROJECTION_COLLISION'):
            make(values)

    def test_reject_partial_collision_even_when_projected_series_nonconstant(self):
        values = ['1', '1.00000000000000000001', '2', '-1']
        self.assertEqual(project_decimal_observations(list(map(Decimal, values))), (1.,1.,2.,-1.))
        with self.assertRaisesRegex(ValueError, 'ACF_PROJECTION_COLLISION'):
            make(values)

    def test_reject_negative_collision(self):
        with self.assertRaisesRegex(ValueError, 'ACF_PROJECTION_COLLISION'):
            make(['-1', '-1.00000000000000000001', '2', '-2'])

    def test_asymmetric_tiny_series_accuracy_and_error_honesty(self):
        self.assert_record(make(SMALL), SMALL)
        self.assertAlmostEqual(make(SMALL)['result']['acf'][1], -221/270, delta=2e-15)

    def test_distinct_representable_noninteger_deltas_keep_truthful_error(self):
        values = ['0.1', '0.2', '-0.3', '0.4', '-0.2']
        self.assert_record(make(values), values)

    def test_ordinary_record_preserves_content_identity(self):
        record = make(['2','-2','2','-2'])
        self.assertEqual(record['id'], 'b4d68078f64407b4f5ba714c58f910101451f4cb9284e957eda53578914e4e12')
        self.assert_record(record, ['2','-2','2','-2'])

    def test_immutable_legacy_record_and_corrected_fresh_identity(self):
        self.assertEqual(sha256(LEGACY.encode('ascii')).hexdigest(),
                         'b9794d46ad90b14aa8d7c6b1dc6a48c0f46566db65e776a3f8bbd4bfd96180be')
        old = json.loads(LEGACY)
        self.assertEqual(decode_record(old['id'], old), old)
        q = qualify_historical_record(old)
        self.assertIs(q['execution_authority'], False)
        fresh = make(SMALL)
        self.assertEqual(fresh['dataset'], old['dataset'])
        self.assertEqual(fresh['result']['exact_reference'], old['result']['exact_reference'])
        self.assertEqual(fresh['status'], old['status'])
        self.assertNotEqual(fresh['id'], old['id'])
        self.assertEqual(canonical(old), LEGACY)

    def test_c_boundary_underflow_and_true_constant_record_refusal(self):
        # The 64-character fixed-point market input cannot reach binary64 underflow.
        # Exercise the canonical ACF boundary separately, not an impossible candle.
        with self.assertRaisesRegex(ValueError, 'ACF_PROJECTION_UNDERFLOW'):
            acf([Decimal('1e-400'), Decimal('1'), Decimal('2')], max_lag=2)
        with self.assertRaisesRegex(ValueError, 'Undefined normalized autocorrelation'):
            make(['1','1','1','1'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
