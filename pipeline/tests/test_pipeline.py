"""Offline tests with synthetic SEC companyfacts.  Run:  python -m unittest discover -s tests"""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from finlab.extract import extract_company, fiscal_year_label, annual_values  # noqa: E402
from finlab.models import altman_z_double_prime, beneish, piotroski, run_models  # noqa: E402
from finlab.peers import build_peers  # noqa: E402
from finlab.ratios import compute_ratios  # noqa: E402

YEARS = [2019, 2020, 2021, 2022, 2023, 2024]


def fact(val, y, start=True, form="10-K", filed=None, days=364):
    end = f"{y}-12-31"
    r = {"val": val, "end": end, "form": form, "filed": filed or f"{y + 1}-02-15", "fy": y, "fp": "FY"}
    if start:
        from datetime import date, timedelta
        r["start"] = (date(y, 12, 31) - timedelta(days=days)).isoformat()
    return r


def synthetic_facts(scale=1.0, switch_revenue_tag=True):
    g = {}

    def add(tag, rows, unit="USD"):
        g.setdefault(tag, {"units": {}})["units"].setdefault(unit, []).extend(rows)

    rev = {y: scale * (100 + 10 * i) for i, y in enumerate(YEARS)}
    for y in YEARS:
        # revenue switches tags in 2022 (very common in real filings)
        tag = "SalesRevenueNet" if switch_revenue_tag and y < 2022 else \
            "RevenueFromContractWithCustomerExcludingAssessedTax"
        add(tag, [fact(rev[y], y)])
        add(tag, [fact(rev[y] / 4, y, days=90)])  # quarterly fact inside a 10-K: must be ignored
        add("CostOfRevenue", [fact(0.6 * rev[y], y)])
        add("OperatingIncomeLoss", [fact(0.2 * rev[y], y)])
        add("InterestExpense", [fact(2 * scale, y)])
        add("IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
            [fact(0.2 * rev[y] - 2 * scale, y)])
        add("IncomeTaxExpenseBenefit", [fact(0.21 * (0.2 * rev[y] - 2 * scale), y)])
        add("NetIncomeLoss", [fact(0.79 * (0.2 * rev[y] - 2 * scale), y)])
        add("NetCashProvidedByUsedInOperatingActivities", [fact(0.18 * rev[y], y)])
        add("NetCashProvidedByUsedInInvestingActivities", [fact(-0.05 * rev[y], y)])
        add("PaymentsToAcquirePropertyPlantAndEquipment", [fact(0.05 * rev[y], y)])
        add("DepreciationDepletionAndAmortization", [fact(0.04 * rev[y], y)])
        add("SellingGeneralAndAdministrativeExpense", [fact(0.1 * rev[y], y)])
        add("PaymentsOfDividends", [fact(0.03 * rev[y], y)])
        add("WeightedAverageNumberOfDilutedSharesOutstanding", [fact(10.0, y)], unit="shares")
        for tag, v in (("Assets", 2 * rev[y]), ("AssetsCurrent", 0.8 * rev[y]),
                       ("LiabilitiesCurrent", 0.5 * rev[y]), ("StockholdersEquity", 0.9 * rev[y]),
                       ("CashAndCashEquivalentsAtCarryingValue", 0.3 * rev[y]),
                       ("AccountsReceivableNetCurrent", 0.2 * rev[y]), ("InventoryNet", 0.15 * rev[y]),
                       ("PropertyPlantAndEquipmentNet", 0.7 * rev[y]), ("AccountsPayableCurrent", 0.1 * rev[y]),
                       ("LongTermDebtNoncurrent", 0.4 * rev[y]), ("RetainedEarningsAccumulatedDeficit", 0.5 * rev[y])):
            add(tag, [fact(v, y, start=False)])
    # a later 10-K restates 2023 net income: latest filing must win
    add("NetIncomeLoss", [fact(999.0 * scale, 2023, filed="2025-02-15")])
    return {"cik": 1, "entityName": "Synthetic Corp", "facts": {"us-gaap": g}}


class ExtractTests(unittest.TestCase):
    def setUp(self):
        self.data = extract_company(synthetic_facts(), "standard", 5)

    def test_fiscal_year_label(self):
        self.assertEqual(fiscal_year_label("2024-01-02"), 2023)
        self.assertEqual(fiscal_year_label("2025-01-31"), 2025)
        self.assertEqual(fiscal_year_label("2024-09-28"), 2024)

    def test_years_and_tag_switch(self):
        self.assertEqual(self.data["years"], YEARS)  # 5 analysis years + 1 prior
        rev = self.data["statements"]["income"]["revenue"]
        self.assertEqual(rev[2019], 100)
        self.assertEqual(rev[2024], 150)  # annual fact, not the quarterly one
        self.assertEqual(self.data["sources"]["revenue"][2019], "SalesRevenueNet")

    def test_restatement_latest_wins(self):
        self.assertEqual(self.data["statements"]["income"]["net_income"][2023], 999.0)

    def test_quarterly_filtered(self):
        vals = annual_values(synthetic_facts(), "SalesRevenueNet", "USD", "flow")
        self.assertEqual(vals[2019][0], 100)

    def test_derived(self):
        st = self.data["statements"]
        self.assertAlmostEqual(st["income"]["gross_profit"][2024], 60)
        self.assertAlmostEqual(st["balance"]["total_liabilities"][2024], 300 - 135)
        self.assertAlmostEqual(st["cashflow"]["fcf"][2024], 0.13 * 150)
        self.assertAlmostEqual(st["income"]["ebitda"][2024], 0.24 * 150)


class RatioTests(unittest.TestCase):
    def setUp(self):
        self.data = extract_company(synthetic_facts(), "standard", 5)
        self.years = self.data["years"][-5:]
        self.r, self.fallback = compute_ratios(self.data, "standard", self.years)

    def test_core_values(self):
        self.assertAlmostEqual(self.r["gross_margin"][2024], 0.4)
        self.assertAlmostEqual(self.r["current_ratio"][2024], 1.6)
        ni = 0.79 * (30 - 2)
        self.assertAlmostEqual(self.r["roe"][2024], ni / ((0.9 * 150 + 0.9 * 140) / 2), places=5)
        self.assertAlmostEqual(self.r["dso"][2024], 365 / (150 / ((30 + 28) / 2)), places=4)
        self.assertEqual(self.fallback, [])  # prior year present -> true averages everywhere

    def test_dupont_identity(self):
        for y in self.years:
            self.assertAlmostEqual(self.r["dupont_roe_check"][y] / self.r["roe"][y], 1, places=4)
            five = (self.r["dupont_tax_burden"][y] * self.r["dupont_interest_burden"][y] *
                    self.r["dupont_ebit_margin"][y] * self.r["dupont_asset_turnover"][y] *
                    self.r["dupont_equity_multiplier"][y])
            if y != 2023:  # 2023 NI was restated independently of pre-tax income
                self.assertAlmostEqual(five / self.r["roe"][y], 1, places=4)

    def test_models(self):
        z = altman_z_double_prime(self.data, 2024)
        self.assertIn(z["zone"], ("safe", "grey", "distress"))
        self.assertIsNotNone(beneish(self.data, 2024))
        self.assertIsNotNone(piotroski(self.data, 2024))
        m = run_models(self.data, self.r, "standard", self.years)
        self.assertEqual(m["forecast"]["target_year"], 2025)
        self.assertAlmostEqual(m["common_size"]["income"]["gross_profit"][2024], 0.4)
        self.assertTrue(any(f["year"] == 2023 for f in m["red_flags"]))  # 999 NI vs flat CFO


class PeerTests(unittest.TestCase):
    def test_percentiles(self):
        comps = {}
        for i, t in enumerate("ABCD"):
            d = extract_company(synthetic_facts(scale=1 + i, switch_revenue_tag=False), "standard", 5)
            r, _ = compute_ratios(d, "standard", d["years"][-5:])
            r["gross_margin"][2024] = 0.3 + 0.1 * i  # make the companies differ
            comps[t] = {"sector": "Tech", "template": "standard", "latest_year": 2024, "ratios": r}
        p = build_peers(comps)
        self.assertEqual(p["companies"]["D"]["ratios"]["gross_margin"]["rank"], 1)
        self.assertEqual(p["companies"]["A"]["ratios"]["gross_margin"]["percentile"], 0.125)
        self.assertEqual(p["groups"]["Tech"]["benchmarks"]["gross_margin"]["n"], 4)


class EndToEndTests(unittest.TestCase):
    def test_build_offline_and_analyze_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            cache = tmp / "cache"
            cache.mkdir()
            tickers = {}
            rows = [("AAA", "Tech"), ("BBB", "Tech"), ("CCC", "Tech"), ("DDD", "Energy")]
            for i, (t, _) in enumerate(rows):
                cik = 100 + i
                tickers[str(i)] = {"cik_str": cik, "ticker": t, "title": t}
                (cache / f"CIK{cik:010d}.json").write_text(json.dumps(synthetic_facts(scale=1 + i)))
            (cache / "company_tickers.json").write_text(json.dumps(tickers))
            comp = tmp / "companies.csv"
            with open(comp, "w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["ticker", "name", "sector", "template"])
                for t, s in rows + [("ZZZ", "Tech")]:
                    w.writerow([t, t + " Inc", s, "standard"])
            out = tmp / "data"
            res = subprocess.run([sys.executable, str(ROOT / "build_dataset.py"), "--offline",
                                  "--companies", str(comp), "--cache", str(cache), "--out", str(out)],
                                 capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            idx = json.loads((out / "index.json").read_text())
            self.assertEqual(len(idx["companies"]), 4)
            self.assertIn("ZZZ", idx["failed"])
            peers = json.loads((out / "peers.json").read_text())
            self.assertEqual(peers["companies"]["DDD"]["benchmark"], "Universe (peer group too small)")
            rec = json.loads((out / "companies" / "AAA.json").read_text())
            self.assertEqual(rec["fiscal_years"], YEARS[-5:])

            res = subprocess.run([sys.executable, str(ROOT / "analyze_file.py"),
                                  str(ROOT / "templates" / "custom_statement_template.csv"),
                                  "--peers", str(out / "peers.json"), "--group", "Tech"],
                                 capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, res.stderr)
            self.assertIn("Return on equity", res.stdout)


class PracticeTests(unittest.TestCase):
    """The fictional training companies must tie out like real statements."""

    def test_statements_tie_out(self):
        import build_practice as bp
        for spec in bp.PRACTICE:
            gen = bp.bank_company if spec["template"] == "bank" else bp.standard_company
            st = gen(spec["params"])
            b, cf = st["balance"], st["cashflow"]
            for y in bp.YEARS:
                self.assertAlmostEqual(b["total_assets"][y], b["total_liabilities"][y] + b["equity"][y], delta=2,
                                       msg=f"{spec['ticker']} {y} balance sheet")
            if spec["template"] == "standard":
                for y0, y1 in zip(bp.YEARS, bp.YEARS[1:]):
                    cash = lambda y: b["cash"][y] + b["short_term_investments"][y]  # noqa: E731
                    self.assertAlmostEqual(cash(y1) - cash(y0), cf["cfo"][y1] + cf["cfi"][y1] + cf["cff"][y1],
                                           delta=5, msg=f"{spec['ticker']} {y1} cash flow")


if __name__ == "__main__":
    unittest.main()
