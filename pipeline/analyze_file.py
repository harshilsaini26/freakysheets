#!/usr/bin/env python3
"""Analyze your own financial statement (any company, any source).

Fill in templates/custom_statement_template.csv (one row per line item, one
column per fiscal year, values in a single currency unit) and run:

    python analyze_file.py my_company.csv
    python analyze_file.py my_bank.csv --template bank
    python analyze_file.py my_company.csv --peers data/peers.json --group "Information Technology"
    python analyze_file.py my_company.csv --json report.json

Unknown rows are ignored; blank cells are treated as missing. Item keys are the
same ones used for the SEC data (see the template's first column).
"""
import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from finlab.concepts import TEMPLATES  # noqa: E402
from finlab.extract import derive  # noqa: E402
from finlab.models import run_models  # noqa: E402
from finlab.ratios import compute_ratios, RATIOS, CATEGORIES  # noqa: E402


def load_statement(path, template):
    mapping = TEMPLATES[template]
    st = {"income": {}, "balance": {}, "cashflow": {}}
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    years = [int(h) for h in header[1:] if h.strip()]
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        key = row[0].strip().split()[0]
        if key not in mapping:
            continue
        series = {}
        for y, cell in zip(years, row[1:]):
            cell = cell.replace(",", "").strip()
            if cell:
                series[y] = float(cell.strip("()")) * (-1 if cell.startswith("(") else 1)
        st[mapping[key]["statement"]][key] = series
    years = sorted(years)
    derive(st, years, template)
    return {"years": years, "statements": st}


def fmt(rid, v):
    if v is None:
        return "-"
    unit = RATIOS[rid]["unit"] if rid in RATIOS else "x"
    return {"days": f"{v:,.1f}d", "pct": f"{v:.1%}", "usd": f"${v:,.2f}"}.get(unit, f"{v:,.2f}x")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--template", choices=list(TEMPLATES), default="standard")
    ap.add_argument("--years", type=int, default=5)
    ap.add_argument("--peers", help="peers.json from build_dataset.py for benchmarking")
    ap.add_argument("--group", help="peer group name in peers.json (e.g. 'Consumer Staples')")
    ap.add_argument("--json", help="write the full report to this file")
    a = ap.parse_args(argv)

    data = load_statement(a.csv, a.template)
    analysis_years = data["years"][-a.years:]  # any extra earlier year is used for averages
    ratios, fallback = compute_ratios(data, a.template, analysis_years)
    models = run_models(data, ratios, a.template, analysis_years)

    bench = {}
    if a.peers and a.group:
        peers = json.loads(Path(a.peers).read_text())
        bench = peers["groups"].get(a.group, {}).get("benchmarks", {})
        if not bench:
            print(f"! group '{a.group}' not found. Options: {', '.join(peers['groups'])}")

    print(f"\nAnalysis years: {analysis_years}")
    if fallback:
        print(f"(ending balances used instead of averages for: {fallback})")
    cat = None
    for rid, series in ratios.items():
        meta = RATIOS.get(rid)
        if not meta or not series:
            continue
        if meta["category"] != cat:
            cat = meta["category"]
            print(f"\n== {CATEGORIES[cat]}")
        vals = "  ".join(f"{fmt(rid, series.get(y)):>9}" for y in analysis_years)
        med = bench.get(rid, {}).get("median")
        tail = f"   peer median {fmt(rid, med)}" if med is not None else ""
        print(f"  {meta['name'][:42]:<42} {vals}{tail}")

    last = analysis_years[-1]
    for name, key, field in (("Altman Z''", "altman_z2", "z_score"), ("Beneish M", "beneish", "m_score"),
                             ("Piotroski F", "piotroski", "f_score")):
        v = models.get(key, {}).get(last)
        if v:
            print(f"\n{name} ({last}): {v[field]}  -> {v['zone']}")
    if models["red_flags"]:
        print("\nRed flags:")
        for f in models["red_flags"]:
            print(f"  {f['year']}  [{f['type']}] {f['title']} ({f['evidence']})")
    if models["forecast"]:
        fc = models["forecast"]
        if fc["revenue_next_cagr_method"] is not None:
            ni = f", net income {fc['net_income_next']:,}" if fc["net_income_next"] is not None else ""
            print(f"\nNext-year projection ({fc['target_year']}, CAGR method): "
                  f"revenue {fc['revenue_next_cagr_method']:,}{ni}")

    if a.json:
        Path(a.json).write_text(json.dumps({"ratios": ratios, "models": models, "statements": data["statements"]},
                                           indent=1))
        print(f"\nWrote {a.json}")


if __name__ == "__main__":
    main()
