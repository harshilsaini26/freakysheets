#!/usr/bin/env python3
"""Download 10-K data from SEC EDGAR for the companies in companies.csv and
write analysis-ready JSON + CSV files.

Usage
    export SEC_USER_AGENT="Your Name your.email@example.com"
    python build_dataset.py                       # all companies, last 5 fiscal years
    python build_dataset.py --only AAPL JPM BRK-B # a subset
    python build_dataset.py --offline             # rebuild from the local cache only

Output (default ./data):
    companies/<TICKER>.json   statements, ratios, DuPont, models, red flags, sources
    index.json                one row per company (for the app's company picker)
    peers.json                peer-group benchmarks, percentiles, scorecards
    ratio_catalog.json        formula + explanation for every ratio (quiz engine)
    csv/statements_long.csv   ticker, fiscal_year, statement, item, value
    csv/ratios_long.csv       ticker, fiscal_year, category, ratio, value
    csv/coverage.csv          data-quality report per company
"""
import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from finlab.extract import extract_company, labels, coverage  # noqa: E402
from finlab.models import run_models  # noqa: E402
from finlab.peers import build_peers, peer_group  # noqa: E402
from finlab.ratios import compute_ratios, catalog, RATIOS  # noqa: E402
from finlab.sec import SecClient, default_user_agent  # noqa: E402


def load_companies(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r["ticker"].strip()]


def analyze(data, template, n_years):
    analysis_years = data["years"][-n_years:]
    ratios, fallback = compute_ratios(data, template, analysis_years)
    models = run_models(data, ratios, template, analysis_years)
    return analysis_years, ratios, fallback, models


def build_one(client, cik, row, n_years):
    facts = client.company_facts(cik)
    if not facts:
        raise RuntimeError("no companyfacts returned")
    template = row["template"]
    data = extract_company(facts, template, n_years)
    if len(data["years"]) < 2:
        raise RuntimeError(f"only {len(data['years'])} fiscal year(s) found")
    analysis_years, ratios, fallback, models = analyze(data, template, n_years)
    cov, missing = coverage(data["statements"], analysis_years, template)
    return {
        "ticker": row["ticker"], "name": row["name"], "entity_name": facts.get("entityName"),
        "cik": cik, "sector": row["sector"], "template": template,
        "peer_group": peer_group(row["sector"], template),
        "fiscal_years": analysis_years, "prior_year": data["years"][0] if len(data["years"]) > n_years else None,
        "period_end": data["period_end"], "units": "USD (per-share in USD, shares in units)",
        "labels": labels(template), "statements": data["statements"], "sources": data["sources"],
        "ratios": ratios, "ratios_used_ending_balance": fallback, "models": models,
        "coverage": {"filled_share": round(cov, 3), "missing_items": missing},
        "source": f"SEC EDGAR XBRL companyfacts, CIK {cik:010d}",
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--companies", default=HERE / "companies.csv")
    ap.add_argument("--out", default=HERE / "data")
    ap.add_argument("--cache", default=HERE / ".cache" / "sec")
    ap.add_argument("--years", type=int, default=5)
    ap.add_argument("--only", nargs="*", help="tickers to (re)build")
    ap.add_argument("--user-agent", default=default_user_agent())
    ap.add_argument("--refresh", action="store_true", help="re-download even if cached")
    ap.add_argument("--offline", action="store_true", help="use the cache only, no network")
    a = ap.parse_args(argv)

    out = Path(a.out)
    (out / "companies").mkdir(parents=True, exist_ok=True)
    (out / "csv").mkdir(parents=True, exist_ok=True)
    client = SecClient(a.user_agent, a.cache, refresh=a.refresh, offline=a.offline)
    rows = load_companies(a.companies)
    if a.only:
        wanted = {t.upper() for t in a.only}
        rows = [r for r in rows if r["ticker"].upper() in wanted]
    tickers = client.ticker_map()

    built, failed = {}, {}
    for i, row in enumerate(rows, 1):
        t = row["ticker"].upper()
        cik = tickers.get(t) or tickers.get(t.replace("-", "."))
        print(f"[{i:>2}/{len(rows)}] {t:<6}", end=" ", flush=True)
        if not cik:
            failed[t] = "ticker not found in SEC ticker map"
            print("SKIP (ticker not in SEC map)")
            continue
        try:
            rec = build_one(client, cik, row, a.years)
        except Exception as e:  # keep going; report at the end
            failed[t] = f"{type(e).__name__}: {e}"
            print(f"FAIL {failed[t]}")
            continue
        (out / "companies" / f"{t}.json").write_text(json.dumps(rec, indent=1))
        built[t] = rec
        print(f"ok  FY{rec['fiscal_years'][0]}-{rec['fiscal_years'][-1]}  coverage {rec['coverage']['filled_share']:.0%}")

    # When building a subset, merge with companies already on disk so peers stay complete.
    for p in (out / "companies").glob("*.json"):
        if p.stem not in built:
            built[p.stem] = json.loads(p.read_text())

    write_outputs(out, built, failed)
    print(f"\nDone: {len(built)} companies in {out}  ({len(failed)} failed)")
    return 1 if failed and not built else 0


def _y(d, y):
    return d.get(y, d.get(str(y)))


def write_outputs(out, built, failed):
    peers_in = {}
    for t, r in built.items():
        ys = r["fiscal_years"]
        peers_in[t] = {"sector": r["sector"], "template": r["template"], "latest_year": ys[-1],
                       "ratios": {k: {int(y): v for y, v in s.items()} for k, s in r["ratios"].items()}}
    peers = build_peers(peers_in)
    (out / "peers.json").write_text(json.dumps(peers, indent=1))
    (out / "ratio_catalog.json").write_text(json.dumps(catalog(), indent=1))

    index = []
    for t, r in sorted(built.items()):
        y = r["fiscal_years"][-1]
        g = lambda sect, k: _y(r["statements"][sect].get(k, {}), y)  # noqa: E731
        rr = lambda k: _y(r["ratios"].get(k, {}), y)  # noqa: E731
        index.append({"ticker": t, "name": r["name"], "sector": r["sector"], "template": r["template"],
                      "peer_group": r["peer_group"], "fiscal_years": r["fiscal_years"],
                      "latest": {"revenue": g("income", "revenue"), "net_income": g("income", "net_income"),
                                 "total_assets": g("balance", "total_assets"), "roe": rr("roe"),
                                 "net_margin": rr("net_margin")},
                      "coverage": r["coverage"]["filled_share"]})
    (out / "index.json").write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "SEC EDGAR XBRL companyfacts (public domain US government data)",
        "companies": index, "failed": failed}, indent=1))

    with open(out / "csv" / "statements_long.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "fiscal_year", "statement", "item", "label", "value", "xbrl_source"])
        for t, r in sorted(built.items()):
            for sect, items in r["statements"].items():
                for item, series in items.items():
                    for y, v in sorted(series.items(), key=lambda kv: int(kv[0])):
                        src = _y(r["sources"].get(item, {}), y) or "derived"
                        w.writerow([t, y, sect, item, r["labels"].get(item, item), v, src])
    with open(out / "csv" / "ratios_long.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "fiscal_year", "category", "ratio_id", "ratio", "value"])
        for t, r in sorted(built.items()):
            for rid, series in r["ratios"].items():
                meta = RATIOS.get(rid, {"category": "dupont", "name": "DuPont ROE check (product of legs)"})
                for y, v in sorted(series.items(), key=lambda kv: int(kv[0])):
                    w.writerow([t, y, meta["category"], rid, meta["name"], v])
    with open(out / "csv" / "coverage.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "template", "fiscal_years", "filled_share", "missing_items", "error"])
        for t, r in sorted(built.items()):
            w.writerow([t, r["template"], f"{r['fiscal_years'][0]}-{r['fiscal_years'][-1]}",
                        r["coverage"]["filled_share"], ";".join(r["coverage"]["missing_items"]), ""])
        for t, err in sorted(failed.items()):
            w.writerow([t, "", "", "", "", err])


if __name__ == "__main__":
    sys.exit(main())
