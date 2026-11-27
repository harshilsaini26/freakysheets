#!/usr/bin/env python3
"""Build the fictional "Training Grounds" companies.

These five companies are invented. Their statements are generated from a few
business-model parameters so that they always tie out (assets = liabilities +
equity, and the change in cash equals CFO + CFI + CFF). Each one is designed to
teach a pattern: a high-margin software firm, a thin-margin retailer with a
negative cash conversion cycle, an industrial whose earnings quality is
slipping, a bank, and a capital-heavy utility.

They run through exactly the same ratio and model code as the SEC companies,
so the web app can use them for lessons and games, and the CSVs double as
sample files for the upload feature.

    python build_practice.py   # writes data/practice/*.json and ../public/samples/*.csv
"""
import csv
import shutil
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from finlab.concepts import TEMPLATES, DERIVED_LABELS  # noqa: E402
from finlab.extract import derive, labels, coverage  # noqa: E402
from finlab.models import run_models  # noqa: E402
from finlab.peers import peer_group  # noqa: E402
from finlab.ratios import compute_ratios, catalog  # noqa: E402

YEARS = [2020, 2021, 2022, 2023, 2024, 2025]
M = 1e6  # all inputs below are in USD millions


def _series(v):
    """A scalar becomes a flat path; a list is used as given (one value per year)."""
    return list(v) if isinstance(v, (list, tuple)) else [v] * len(YEARS)


def standard_company(p):
    """Generate tied-out statements for a non-financial company from parameters."""
    n = len(YEARS)
    growth = _series(p["growth"])
    gm, rnd, sga, da = (_series(p[k]) for k in ("gross_margin", "rnd", "sga", "da"))
    dso, dio, dpo = (_series(p[k]) for k in ("dso", "dio", "dpo"))
    ppe_ratio, tax = _series(p["ppe_to_rev"]), _series(p["tax"])
    debt_st, debt_lt = _series(p["debt_st"]), _series(p["debt_lt"])
    rate, payout, buyback = _series(p["rate"]), _series(p["payout"]), _series(p["buyback_share"])
    sbc_pct, shares = _series(p["sbc"]), _series(p["shares"])
    acq = _series(p.get("acquisition", 0.0))
    st = {"income": {}, "balance": {}, "cashflow": {}}

    def put(sect, item, i, v):
        st[sect].setdefault(item, {})[YEARS[i]] = round(v * M, 0)

    rev = p["rev0"]
    cash, eq, re_ = p["cash0"], p["equity0"], p["re0"]
    gw, intang = p["goodwill0"], p["intang0"]
    prev = None
    for i in range(n):
        if i > 0:
            rev *= 1 + growth[i]
        cogs = rev * (1 - gm[i])
        gp = rev - cogs
        dna = rev * da[i]
        op = gp - rev * rnd[i] - rev * sga[i]
        avg_debt = debt_st[i] + debt_lt[i]
        interest = avg_debt * rate[i]
        pretax = op - interest + p.get("other_income", 0.0) * rev
        itx = pretax * tax[i]
        ni = pretax - itx
        sbc = rev * sbc_pct[i]
        rec, inv, ap = rev * dso[i] / 365, cogs * dio[i] / 365, cogs * dpo[i] / 365
        accrued = rev * p.get("accrued", 0.06)
        ppe = rev * ppe_ratio[i]
        amort = min(intang, dna * 0.15)
        div = max(ni, 0) * payout[i]
        bb = max(ni, 0) * buyback[i]

        if prev is None:
            capex = dna
            cfo = ni + dna + sbc
            cfi = -capex
            cff = 0.0
            intang_now = intang
        else:
            intang_now = prev["intang"] - amort + acq[i] * 0.4
            gw += acq[i] * 0.6
            capex = ppe - prev["ppe"] + (dna - amort)
            d_wc = (rec - prev["rec"]) + (inv - prev["inv"]) - (ap - prev["ap"]) - (accrued - prev["accrued"])
            cfo = ni + dna + sbc - d_wc
            cfi = -capex - acq[i]
            d_debt = (debt_st[i] + debt_lt[i]) - (prev["debt"])
            cff = d_debt - div - bb
            cash = prev["cash"] + cfo + cfi + cff
            eq = prev["eq"] + ni - div - bb + sbc
            re_ = prev["re"] + ni - div
        sti = max(cash * 0.2, 0)
        other_ca = rev * 0.03
        ca = cash + sti + rec + inv + other_ca
        other_nca = rev * 0.05
        ta = ca + ppe + gw + intang_now + other_nca
        cl = ap + accrued + debt_st[i] + rev * 0.02
        tl = ta - eq

        # Cash shown is cash + ST investments split for realism; CFO/CFI/CFF tie to their sum.
        vals = {
            "income": {"revenue": rev, "cost_of_revenue": cogs, "gross_profit": gp, "rnd": rev * rnd[i],
                       "sga": rev * sga[i], "operating_income": op, "interest_expense": interest,
                       "pretax_income": pretax, "income_tax": itx, "net_income": ni},
            "balance": {"cash": cash - sti, "short_term_investments": sti, "receivables": rec, "inventory": inv,
                        "current_assets": ca, "ppe": ppe, "goodwill": gw, "intangibles": intang_now,
                        "total_assets": ta, "accounts_payable": ap, "short_term_debt": debt_st[i],
                        "current_liabilities": cl, "long_term_debt": debt_lt[i], "total_liabilities": tl,
                        "equity": eq, "retained_earnings": re_},
            "cashflow": {"cfo": cfo, "capex": capex, "cfi": cfi, "cff": cff, "dividends_paid": div,
                         "buybacks": bb, "sbc": sbc, "d_and_a": dna},
        }
        for sect, items in vals.items():
            for k, v in items.items():
                put(sect, k, i, v)
        st["income"].setdefault("shares_diluted", {})[YEARS[i]] = round(shares[i])
        st["balance"].setdefault("shares_outstanding", {})[YEARS[i]] = round(shares[i] * 0.99)
        st["income"].setdefault("eps_diluted", {})[YEARS[i]] = round(ni * M / shares[i], 2)
        prev = {"rec": rec, "inv": inv, "ap": ap, "accrued": accrued, "ppe": ppe, "intang": intang_now,
                "debt": debt_st[i] + debt_lt[i], "cash": cash, "eq": eq, "re": re_}
    return st


def bank_company(p):
    n = len(YEARS)
    growth = _series(p["growth"])
    st = {"income": {}, "balance": {}, "cashflow": {}}
    assets = p["assets0"]
    eq, re_ = p["equity0"], p["re0"]
    prev = None
    for i in range(n):
        if i > 0:
            assets *= 1 + growth[i]
        loans = assets * p["loans_share"][i]
        allowance = loans * p["allowance"][i]
        deposits = assets * p["deposit_share"][i]
        ii = assets * p["asset_yield"][i]
        ie = deposits * p["deposit_cost"][i] + assets * 0.08 * p["deposit_cost"][i] * 1.5
        nii = ii - ie
        nonii = nii * p["fee_ratio"][i]
        rev = nii + nonii
        prov = loans * p["credit_cost"][i]
        nie = rev * p["efficiency"][i]
        pretax = rev - prov - nie
        tax = pretax * 0.21
        ni = pretax - tax
        div = ni * 0.35
        bb = ni * 0.25
        if prev is not None:
            eq = prev["eq"] + ni - div - bb
            re_ = prev["re"] + ni - div
        cash = assets * 0.12
        st_debt, lt_debt = assets * 0.03, assets * 0.08
        cfo = ni * 1.1 + prov
        if prev is None:
            cfi, cff = -cfo * 0.5, -(div + bb)
        else:
            cfi = -(loans - prev["loans"]) - (assets - prev["assets"]) * 0.35
            cff = (deposits - prev["deposits"]) + (st_debt + lt_debt - prev["debt"]) - div - bb
        vals = {
            "income": {"interest_income": ii, "interest_expense": ie, "net_interest_income": nii,
                       "noninterest_income": nonii, "revenue": rev, "provision": prov,
                       "noninterest_expense": nie, "pretax_income": pretax, "income_tax": tax, "net_income": ni},
            "balance": {"cash": cash, "loans": loans, "loan_allowance": allowance, "deposits": deposits,
                        "total_assets": assets, "short_term_debt": st_debt, "long_term_debt": lt_debt,
                        "total_liabilities": assets - eq, "equity": eq, "retained_earnings": re_,
                        "goodwill": assets * 0.012, "intangibles": assets * 0.002},
            "cashflow": {"cfo": cfo, "cfi": cfi, "cff": cff, "dividends_paid": div, "buybacks": bb,
                         "sbc": rev * 0.02, "d_and_a": rev * 0.03},
        }
        for sect, items in vals.items():
            for k, v in items.items():
                st[sect].setdefault(k, {})[YEARS[i]] = round(v * M, 0)
        sh = p["shares"][i]
        st["income"].setdefault("shares_diluted", {})[YEARS[i]] = round(sh * M)
        st["balance"].setdefault("shares_outstanding", {})[YEARS[i]] = round(sh * M * 0.99)
        st["income"].setdefault("eps_diluted", {})[YEARS[i]] = round(ni / sh, 2)
        prev = {"eq": eq, "re": re_, "loans": loans, "assets": assets, "deposits": deposits,
                "debt": st_debt + lt_debt}
    return st


def flat(v):
    return [v] * len(YEARS)


PRACTICE = [
    {"ticker": "NIMBUS", "name": "Nimbus Cloud Software", "sector": "Information Technology",
     "template": "standard",
     "blurb": "Subscription software. Very high gross margin, heavy R&D and stock pay, almost no inventory.",
     "lesson": "High margins and asset-light growth. Watch how stock-based compensation flatters cash flow.",
     "params": dict(rev0=4000, growth=[0, .28, .24, .20, .17, .15], gross_margin=[.74, .75, .76, .77, .78, .79],
                    rnd=[.24, .23, .22, .21, .20, .19], sga=[.38, .36, .34, .32, .30, .29], da=.04,
                    dso=58, dio=0, dpo=30, ppe_to_rev=.12, tax=[.05, .08, .12, .15, .17, .18],
                    debt_st=0, debt_lt=1500, rate=.035, payout=0, buyback_share=[0, 0, .3, .5, .6, .7],
                    sbc=[.14, .14, .13, .13, .12, .12], shares=[300e6, 306e6, 311e6, 315e6, 316e6, 315e6],
                    cash0=3000, equity0=4200, re0=-600, goodwill0=900, intang0=300, accrued=.32)},
    {"ticker": "BIGBOX", "name": "BigBox Grocers", "sector": "Consumer Staples", "template": "standard",
     "blurb": "Warehouse-style grocer. Razor-thin margins, huge sales per dollar of assets, and suppliers fund the inventory.",
     "lesson": "Low margin times high turnover can still give a strong ROE. A negative cash conversion cycle is a funding advantage.",
     "params": dict(rev0=120000, growth=[0, .06, .09, .07, .05, .05], gross_margin=flat(.125),
                    rnd=0, sga=[.094, .093, .093, .092, .092, .091], da=.011, dso=4, dio=30, dpo=36,
                    ppe_to_rev=.17, tax=.24, debt_st=800, debt_lt=6500, rate=.04, payout=.30,
                    buyback_share=.15, sbc=.004, shares=flat(445e6), cash0=9000, equity0=17000, re0=12000,
                    goodwill0=0, intang0=0)},
    {"ticker": "IRONWK", "name": "Ironworks Machinery", "sector": "Industrials", "template": "standard",
     "blurb": "Heavy-equipment maker that bought a rival in 2023 with debt. Reported profit keeps rising, but look at the cash.",
     "lesson": "Earnings quality. Receivables and inventory are growing much faster than sales, so profit is not turning into cash.",
     "params": dict(rev0=18000, growth=[0, .07, .06, .09, .05, .04], gross_margin=[.30, .30, .31, .32, .33, .335],
                    rnd=.03, sga=[.15, .15, .15, .145, .14, .135], da=.035, dso=[55, 56, 58, 70, 84, 98],
                    dio=[80, 82, 85, 100, 118, 135], dpo=[50, 50, 48, 45, 42, 40], ppe_to_rev=.32, tax=.22,
                    debt_st=[800, 800, 900, 1800, 2400, 3000], debt_lt=[5000, 4800, 4600, 9800, 10400, 11200],
                    rate=[.045, .045, .05, .06, .065, .07], payout=.35, buyback_share=[.2, .2, .2, 0, 0, 0],
                    sbc=.008, shares=[400e6, 398e6, 396e6, 418e6, 431e6, 446e6],
                    acquisition=[0, 0, 0, 5200, 0, 0], cash0=2500, equity0=8000, re0=7000,
                    goodwill0=2500, intang0=900)},
    {"ticker": "HARBOR", "name": "Harbor National Bank", "sector": "Financials", "template": "bank",
     "blurb": "Regional bank funded by customer deposits. Earns a spread between loan yields and deposit costs.",
     "lesson": "Banks are read differently: net interest income, efficiency ratio, credit costs and capital.",
     "params": dict(assets0=250000, growth=[0, .05, .04, .03, .04, .05],
                    loans_share=[.60, .61, .62, .63, .63, .64], allowance=[.016, .013, .012, .013, .014, .014],
                    deposit_share=[.80, .81, .79, .77, .78, .78],
                    asset_yield=[.033, .030, .036, .048, .050, .047], deposit_cost=[.004, .002, .008, .020, .024, .021],
                    fee_ratio=[.45, .44, .40, .38, .39, .40], credit_cost=[.008, .002, .003, .005, .006, .005],
                    efficiency=[.60, .61, .58, .57, .59, .58], equity0=24000, re0=18000,
                    shares=[900, 890, 880, 868, 858, 848])},
    {"ticker": "SUNRAY", "name": "SunRay Power & Light", "sector": "Utilities", "template": "standard",
     "blurb": "Regulated electric utility. Slow, steady growth, enormous fixed assets and lots of debt.",
     "lesson": "Capital-intensive firms have low asset turnover and high leverage; coverage ratios matter more than margins.",
     "params": dict(rev0=15000, growth=[0, .03, .05, .04, .03, .04], gross_margin=flat(.55), rnd=0,
                    sga=flat(.22), da=.15, dso=45, dio=25, dpo=55, ppe_to_rev=[4.2, 4.3, 4.4, 4.5, 4.6, 4.7],
                    tax=.18, debt_st=[2500, 2600, 2800, 3000, 3100, 3300],
                    debt_lt=[28000, 31200, 34800, 38400, 42000, 45800], rate=.042, payout=.62,
                    buyback_share=0, sbc=.003, shares=[500e6, 505e6, 512e6, 520e6, 528e6, 536e6],
                    cash0=600, equity0=22000, re0=9000, goodwill0=4000, intang0=200)},
]


def build_record(spec, statements):
    template = spec["template"]
    derive(statements, YEARS, template)
    data = {"years": YEARS, "statements": statements}
    analysis_years = YEARS[1:]
    ratios, fallback = compute_ratios(data, template, analysis_years)
    models = run_models(data, ratios, template, analysis_years)
    cov, missing = coverage(statements, analysis_years, template)
    return {
        "ticker": spec["ticker"], "name": spec["name"], "entity_name": spec["name"], "cik": None,
        "sector": spec["sector"], "template": template, "peer_group": peer_group(spec["sector"], template),
        "practice": True, "blurb": spec["blurb"], "lesson": spec["lesson"],
        "fiscal_years": analysis_years, "prior_year": YEARS[0], "period_end": {y: f"{y}-12-31" for y in YEARS},
        "units": "USD (fictional training company)", "labels": labels(template), "statements": statements,
        "sources": {}, "ratios": ratios, "ratios_used_ending_balance": fallback, "models": models,
        "coverage": {"filled_share": round(cov, 3), "missing_items": missing},
        "source": "Fictional company generated by pipeline/build_practice.py",
    }


def write_sample_csv(path, spec, statements):
    """Write the reported (not derived) lines in the upload template format."""
    mapping = TEMPLATES[spec["template"]]
    lab = labels(spec["template"])
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["item", *YEARS])
        for key in mapping:
            sect = mapping[key]["statement"]
            series = statements[sect].get(key)
            if not series:
                continue
            w.writerow([f"{key} - {lab[key]}", *[series.get(y, "") for y in YEARS]])


def main():
    out = HERE / "data" / "practice"
    samples = HERE.parent / "public" / "samples"  # served by the web app as downloadable examples
    out.mkdir(parents=True, exist_ok=True)
    samples.mkdir(parents=True, exist_ok=True)
    index = []
    for spec in PRACTICE:
        gen = bank_company if spec["template"] == "bank" else standard_company
        st = gen(spec["params"])
        write_sample_csv(samples / f"{spec['ticker'].lower()}_sample.csv", spec, st)
        rec = build_record(spec, st)
        (out / f"{spec['ticker']}.json").write_text(json.dumps(rec, indent=1))
        y = rec["fiscal_years"][-1]
        index.append({"ticker": rec["ticker"], "name": rec["name"], "sector": rec["sector"],
                      "template": rec["template"], "peer_group": rec["peer_group"], "practice": True,
                      "blurb": rec["blurb"], "fiscal_years": rec["fiscal_years"],
                      "latest": {"revenue": st["income"]["revenue"][y], "net_income": st["income"]["net_income"][y],
                                 "total_assets": st["balance"]["total_assets"][y],
                                 "roe": rec["ratios"].get("roe", {}).get(y),
                                 "net_margin": rec["ratios"].get("net_margin", {}).get(y)},
                      "coverage": rec["coverage"]["filled_share"]})
        flags = len(rec["models"]["red_flags"])
        print(f"{rec['ticker']:<7} ok  red flags: {flags}")
    (out / "index.json").write_text(json.dumps({"companies": index}, indent=1))
    shutil.copy(HERE / "templates" / "custom_statement_template.csv", samples / "template.csv")
    (HERE / "data" / "ratio_catalog.json").write_text(json.dumps(catalog(), indent=1))
    # Line-item definitions for the web app's upload parser (keeps TypeScript and Python in sync).
    concepts = {t: [{"key": k, "statement": v["statement"], "label": v["label"] or k} for k, v in m.items()]
                for t, m in TEMPLATES.items()}
    (HERE / "data" / "concepts.json").write_text(json.dumps({"templates": concepts, "derived": DERIVED_LABELS},
                                                            indent=1))


if __name__ == "__main__":
    main()
