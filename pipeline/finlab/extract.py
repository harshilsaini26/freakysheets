"""Turn an SEC companyfacts JSON into clean annual statements.

Output shape (per company):
    {
      "years": [2020, ..., 2025],                 # oldest -> newest
      "period_end": {2025: "2025-09-27", ...},
      "statements": {"income": {item: {year: value}}, "balance": {...}, "cashflow": {...}},
      "sources": {item: {year: "us-gaap tag(s)"}},  # audit trail / "explain this number"
    }
"""
from datetime import date

from .concepts import TEMPLATES, DERIVED_LABELS

ANNUAL_FORMS = {"10-K", "10-K/A", "10-KT", "10-KT/A"}


def fiscal_year_label(end):
    """Fiscal year = calendar year of period end, except 52/53-week years that
    end in the first week of January (e.g. 2024-01-02 -> FY2023)."""
    d = date.fromisoformat(end)
    return d.year - 1 if (d.month == 1 and d.day <= 7) else d.year


def _days(start, end):
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def annual_values(facts, tag, unit, kind):
    """{fiscal_year: (value, end_date)} for one us-gaap tag, annual 10-K facts only.
    When the same period is reported in several filings the latest filing wins
    (i.e. restated figures)."""
    try:
        rows = facts["facts"]["us-gaap"][tag]["units"][unit]
    except KeyError:
        return {}
    best = {}
    for r in rows:
        if r.get("form") not in ANNUAL_FORMS or "end" not in r:
            continue
        if kind == "flow":
            if "start" not in r or not 340 <= _days(r["start"], r["end"]) <= 390:
                continue
        elif "start" in r:
            continue
        fy = fiscal_year_label(r["end"])
        key = (r.get("filed", ""), r["end"])
        if fy not in best or key > best[fy][0]:
            best[fy] = (key, r["val"], r["end"])
    return {fy: (v, end) for fy, (_, v, end) in best.items()}


def _resolve(facts, spec):
    """Per-year value for a line item, trying alternatives in priority order."""
    per_alt = []
    for alt in spec["alts"]:
        tags = alt if isinstance(alt, tuple) else (alt,)
        series = [annual_values(facts, t, spec["unit"], spec["kind"]) for t in tags]
        years = set().union(*[s.keys() for s in series])
        combined = {}
        for y in years:
            present = [(t, s[y]) for t, s in zip(tags, series) if y in s]
            combined[y] = (sum(v for _, (v, _) in present),
                           present[0][1][1],
                           " + ".join(t for t, _ in present))
        per_alt.append(combined)
    out = {}
    for combined in per_alt:  # earlier alternatives have priority
        for y, val in combined.items():
            out.setdefault(y, val)
    return out


def extract_company(facts, template="standard", n_years=5):
    mapping = TEMPLATES[template]
    raw = {name: _resolve(facts, spec) for name, spec in mapping.items()}

    # Spine of fiscal years: years that have both an income figure and a balance sheet.
    spine = sorted(set(raw.get("net_income", {})) & set(raw.get("total_assets", {})))
    years = spine[-(n_years + 1):]  # one extra year so averages work for the first analysis year

    statements = {"income": {}, "balance": {}, "cashflow": {}}
    sources, period_end = {}, {}
    for name, spec in mapping.items():
        series = {y: raw[name][y][0] for y in years if y in raw[name]}
        statements[spec["statement"]][name] = series
        sources[name] = {y: raw[name][y][2] for y in years if y in raw[name]}
        if name == "total_assets":
            period_end = {y: raw[name][y][1] for y in years if y in raw[name]}

    derive(statements, years, template)
    return {"years": years, "period_end": period_end, "statements": statements, "sources": sources}


def _g(st, item, y):
    for sect in st.values():
        if item in sect:
            return sect[item].get(y)
    return None


def _set(st, sect, item, y, v):
    if v is not None:
        st[sect].setdefault(item, {})
        st[sect][item].setdefault(y, v)  # never overwrite a reported number


def _sum(*vals):
    vals = [v for v in vals if v is not None]
    return sum(vals) if vals else None


def derive(st, years, template):
    """Fill gaps with accounting identities and add analyst-friendly subtotals."""
    for y in years:
        g = lambda k: _g(st, k, y)  # noqa: E731
        rev = g("revenue")
        if template == "bank" and rev is None:
            rev = _sum(g("net_interest_income"), g("noninterest_income"))
            _set(st, "income", "revenue", y, rev)
        if template == "bank" and g("net_interest_income") is None and g("interest_income") is not None:
            _set(st, "income", "net_interest_income", y, g("interest_income") - (g("interest_expense") or 0))

        # gross profit / COGS identity
        if rev is not None:
            if g("gross_profit") is None and g("cost_of_revenue") is not None:
                _set(st, "income", "gross_profit", y, rev - g("cost_of_revenue"))
            if g("cost_of_revenue") is None and g("gross_profit") is not None:
                _set(st, "income", "cost_of_revenue", y, rev - g("gross_profit"))

        # liabilities = assets - equity (many filers omit the "Liabilities" total)
        eq_total = g("equity_incl_nci") if g("equity_incl_nci") is not None else g("equity")
        if g("total_liabilities") is None and g("total_assets") is not None and eq_total is not None:
            _set(st, "balance", "total_liabilities", y, g("total_assets") - eq_total)

        # EBIT: reported operating income, else pre-tax income + interest expense
        ebit = g("operating_income")
        if ebit is None and g("pretax_income") is not None and template != "bank":
            ebit = g("pretax_income") + (g("interest_expense") or 0)
        _set(st, "income", "ebit", y, ebit)
        if ebit is not None and g("d_and_a") is not None:
            _set(st, "income", "ebitda", y, ebit + g("d_and_a"))
        if g("pretax_income") and g("income_tax") is not None:
            _set(st, "income", "effective_tax_rate", y, g("income_tax") / g("pretax_income"))

        debt = _sum(g("short_term_debt"), g("long_term_debt"))
        _set(st, "balance", "total_debt", y, debt)
        if debt is not None:
            _set(st, "balance", "net_debt", y, debt - (g("cash") or 0) - (g("short_term_investments") or 0))
        if debt is not None and g("equity") is not None:
            _set(st, "balance", "invested_capital", y, debt + g("equity"))
        if g("current_assets") is not None and g("current_liabilities") is not None:
            _set(st, "balance", "working_capital", y, g("current_assets") - g("current_liabilities"))
        if g("equity") is not None:
            _set(st, "balance", "tangible_equity", y,
                 g("equity") - (g("goodwill") or 0) - (g("intangibles") or 0))

        if g("cfo") is not None and g("capex") is not None:
            _set(st, "cashflow", "fcf", y, g("cfo") - g("capex"))


def labels(template):
    out = {k: (v["label"] or k) for k, v in TEMPLATES[template].items()}
    out.update(DERIVED_LABELS)
    return out


def coverage(statements, years, template):
    """Share of (item, year) cells filled — used for the QA report."""
    names = list(TEMPLATES[template])
    filled = sum(1 for n in names for y in years if _g(statements, n, y) is not None)
    total = len(names) * max(len(years), 1)
    missing = [n for n in names if all(_g(statements, n, y) is None for y in years)]
    return filled / total, missing
