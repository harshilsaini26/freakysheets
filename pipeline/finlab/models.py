"""Descriptive, diagnostic and predictive analytics built on the statements.

Descriptive  : common-size (vertical) and trend (horizontal) analysis, CAGRs
Diagnostic   : Beneish M-score, Piotroski F-score, accrual & red-flag checks
Predictive   : Altman Z''-score (distress), next-year projections, sustainable growth

All of these are teaching tools built on public 10-K data. They are not
investment advice and the projections are deliberately simple so the user can
reproduce them by hand.
"""
import math

from .ratios import Ctx, div


# ----------------------------------------------------------------- descriptive
def common_size(data, analysis_years):
    """Vertical analysis: income & cash-flow items as % of revenue, balance items as % of assets."""
    st = data["statements"]
    out = {"income": {}, "balance": {}, "cashflow": {}}
    for sect, base in (("income", "revenue"), ("cashflow", "revenue"), ("balance", "total_assets")):
        for item, series in st[sect].items():
            if item == "effective_tax_rate":
                continue
            vals = {}
            for y in analysis_years:
                b = Ctx(data, y).get(base)
                v = series.get(y)
                if v is not None and b:
                    vals[y] = round(v / b, 6)
            if vals:
                out[sect][item] = vals
    return out


def trend_index(data, analysis_years, items=("revenue", "gross_profit", "ebit", "net_income", "cfo",
                                             "total_assets", "equity", "total_debt")):
    """Horizontal analysis: each item indexed to 100 in the first analysis year."""
    out = {}
    base_y = analysis_years[0] if analysis_years else None
    for it in items:
        c0 = Ctx(data, base_y).get(it) if base_y is not None else None
        if not c0:
            continue
        out[it] = {y: round(100 * Ctx(data, y).get(it) / c0, 2)
                   for y in analysis_years if Ctx(data, y).get(it) is not None}
    return out


def cagr(first, last, years):
    if first is None or last is None or years <= 0 or first <= 0 or last <= 0:
        return None
    return (last / first) ** (1 / years) - 1


def growth_summary(data, analysis_years):
    out = {}
    if len(analysis_years) < 2:
        return out
    y0, y1 = analysis_years[0], analysis_years[-1]
    for it in ("revenue", "net_income", "eps_diluted", "cfo", "fcf", "total_assets", "equity", "dividends_paid"):
        v = cagr(Ctx(data, y0).get(it), Ctx(data, y1).get(it), y1 - y0)
        if v is not None:
            out[it] = round(v, 6)
    return out


# ------------------------------------------------------------------ diagnostic
BENEISH_W = {"DSRI": 0.92, "GMI": 0.528, "AQI": 0.404, "SGI": 0.892, "DEPI": 0.115,
             "SGAI": -0.172, "TATA": 4.679, "LVGI": -0.327}


def beneish(data, y):
    """Beneish (1999) 8-variable M-score. M > -1.78 suggests a higher likelihood of
    earnings manipulation. Missing indices are set to 1.0 (neutral) and reported."""
    c = Ctx(data, y)
    if c.prev is None:
        return None
    g, p = c.get, c.p
    if None in (g("revenue"), p("revenue"), g("total_assets"), p("total_assets")):
        return None

    def ratio(a, b):
        return None if a is None or b in (None, 0) else a / b

    def gm(rev, cogs):
        return None if rev in (None, 0) or cogs is None else (rev - cogs) / rev

    def aq(ca, ppe, ta):
        return None if None in (ca, ppe, ta) or ta == 0 else 1 - (ca + ppe) / ta

    def dep(d, ppe):
        return None if None in (d, ppe) or d + ppe == 0 else d / (d + ppe)

    def lev(cl, ltd, ta):
        return None if cl is None or ta in (None, 0) else (cl + (ltd or 0)) / ta

    idx = {
        "DSRI": ratio(ratio(g("receivables"), g("revenue")), ratio(p("receivables"), p("revenue"))),
        "GMI": ratio(gm(p("revenue"), p("cost_of_revenue")), gm(g("revenue"), g("cost_of_revenue"))),
        "AQI": ratio(aq(g("current_assets"), g("ppe"), g("total_assets")),
                     aq(p("current_assets"), p("ppe"), p("total_assets"))),
        "SGI": ratio(g("revenue"), p("revenue")),
        "DEPI": ratio(dep(p("d_and_a"), p("ppe")), dep(g("d_and_a"), g("ppe"))),
        "SGAI": ratio(ratio(g("sga"), g("revenue")), ratio(p("sga"), p("revenue"))),
        "LVGI": ratio(lev(g("current_liabilities"), g("long_term_debt"), g("total_assets")),
                      lev(p("current_liabilities"), p("long_term_debt"), p("total_assets"))),
        "TATA": ratio(None if g("net_income") is None or g("cfo") is None else g("net_income") - g("cfo"),
                      g("total_assets")),
    }
    imputed = [k for k, v in idx.items() if v is None]
    if len(imputed) > 3:
        return None
    for k in imputed:
        idx[k] = 0.0 if k == "TATA" else 1.0
    m = -4.84 + sum(BENEISH_W[k] * idx[k] for k in idx)
    return {"m_score": round(m, 3), "components": {k: round(v, 4) for k, v in idx.items()},
            "imputed": imputed, "threshold": -1.78,
            "zone": "likely manipulator" if m > -1.78 else "unlikely manipulator"}


def piotroski(data, y):
    """Piotroski (2000) F-score, 0-9. 8-9 strong, 0-2 weak."""
    c = Ctx(data, y)
    if c.prev is None:
        return None
    g, p = c.get, c.p
    prev2 = data["years"][data["years"].index(y) - 2] if data["years"].index(y) >= 2 else None

    def roa(cur_y, prev_y):
        ni = Ctx(data, cur_y).get("net_income")
        ta = Ctx(data, prev_y).get("total_assets") if prev_y is not None else None
        ta = ta or Ctx(data, cur_y).get("total_assets")
        return div(ni, ta)

    roa_t, roa_p = roa(y, c.prev), roa(c.prev, prev2)
    cfo_ta = div(g("cfo"), p("total_assets") or g("total_assets"))
    lev_t, lev_p = div(g("long_term_debt") or 0, g("total_assets")), div(p("long_term_debt") or 0, p("total_assets"))
    cr_t, cr_p = div(g("current_assets"), g("current_liabilities")), div(p("current_assets"), p("current_liabilities"))
    gm_t = div(g("gross_profit"), g("revenue"))
    gm_p = div(p("gross_profit"), p("revenue"))
    at_t, at_p = div(g("revenue"), p("total_assets")), div(p("revenue"), Ctx(data, prev2).get("total_assets")
                                                         if prev2 else p("total_assets"))
    tests = {
        "positive_roa": None if roa_t is None else roa_t > 0,
        "positive_cfo": None if g("cfo") is None else g("cfo") > 0,
        "improving_roa": None if None in (roa_t, roa_p) else roa_t > roa_p,
        "cfo_exceeds_net_income": None if None in (cfo_ta, roa_t) else cfo_ta > roa_t,
        "lower_leverage": None if None in (lev_t, lev_p) else lev_t <= lev_p,
        "higher_current_ratio": None if None in (cr_t, cr_p) else cr_t > cr_p,
        "no_dilution": None if None in (g("shares_diluted"), p("shares_diluted"))
        else g("shares_diluted") <= p("shares_diluted"),
        "higher_gross_margin": None if None in (gm_t, gm_p) else gm_t > gm_p,
        "higher_asset_turnover": None if None in (at_t, at_p) else at_t > at_p,
    }
    available = {k: v for k, v in tests.items() if v is not None}
    if len(available) < 6:
        return None
    score = sum(available.values())
    return {"f_score": score, "max_possible": len(available), "tests": tests,
            "zone": "strong" if score >= 7 else "weak" if score <= 3 else "neutral"}


def altman_z_double_prime(data, y):
    """Altman Z''-score (book-equity version for non-manufacturers / no market data).
    Z'' = 6.56 X1 + 3.26 X2 + 6.72 X3 + 1.05 X4.  > 2.6 safe, 1.1-2.6 grey, < 1.1 distress.
    Not meaningful for banks."""
    c = Ctx(data, y)
    ta, tl = c.get("total_assets"), c.get("total_liabilities")
    eq = c.get("equity_incl_nci") if c.get("equity_incl_nci") is not None else c.get("equity")
    if None in (ta, tl, eq, c.get("working_capital"), c.get("retained_earnings"), c.get("ebit")) or not ta or not tl:
        return None
    x = {"X1_working_capital_to_assets": c.get("working_capital") / ta,
         "X2_retained_earnings_to_assets": c.get("retained_earnings") / ta,
         "X3_ebit_to_assets": c.get("ebit") / ta,
         "X4_book_equity_to_liabilities": eq / tl}
    w = (6.56, 3.26, 6.72, 1.05)
    z = sum(wi * xi for wi, xi in zip(w, x.values()))
    return {"z_score": round(z, 3), "components": {k: round(v, 4) for k, v in x.items()},
            "zone": "safe" if z > 2.6 else "grey" if z >= 1.1 else "distress"}


def red_flags(data, ratios, analysis_years):
    """Rule-based warning signs — the answer key for the 'Red Flag Hunt' game."""
    flags = []

    def r(rid, y):
        return ratios.get(rid, {}).get(y)

    for y in analysis_years[1:]:
        c = Ctx(data, y)
        g, p = c.get, c.p
        ni_g, cfo_g, rev_g = r("net_income_growth", y), r("cfo_growth", y), r("revenue_growth", y)
        if ni_g is not None and cfo_g is not None and ni_g > 0.05 and cfo_g < -0.05:
            flags.append((y, "earnings_quality", "Net income rose while operating cash flow fell",
                          f"NI {ni_g:+.1%} vs CFO {cfo_g:+.1%}"))
        rec_g = div(g("receivables"), p("receivables"))
        if rec_g and rev_g is not None and (rec_g - 1) - rev_g > 0.10:
            flags.append((y, "revenue_recognition", "Receivables grew much faster than revenue",
                          f"AR {rec_g - 1:+.1%} vs revenue {rev_g:+.1%}"))
        inv_g = div(g("inventory"), p("inventory"))
        if inv_g and rev_g is not None and (inv_g - 1) - rev_g > 0.15:
            flags.append((y, "inventory", "Inventory built up faster than sales",
                          f"Inventory {inv_g - 1:+.1%} vs revenue {rev_g:+.1%}"))
        cc = r("cash_conversion", y)
        if cc is not None and g("net_income") and g("net_income") > 0 and cc < 0.8:
            flags.append((y, "earnings_quality", "Less than 80% of profit converted to operating cash",
                          f"CFO/NI = {cc:.2f}"))
        ic = r("interest_coverage", y)
        if ic is not None and 0 < ic < 3:
            flags.append((y, "solvency", "Thin interest coverage", f"EBIT/interest = {ic:.1f}x"))
        de, de_p = r("debt_to_equity", y), r("debt_to_equity", c.prev)
        if de is not None and de_p is not None and de - de_p > 0.5:
            flags.append((y, "solvency", "Debt-to-equity jumped", f"{de_p:.2f} -> {de:.2f}"))
        if g("equity") is not None and g("equity") < 0:
            flags.append((y, "solvency", "Negative shareholders' equity (often from buybacks, check why)",
                          f"Equity = {g('equity') / 1e9:,.1f}bn"))
        cr = r("current_ratio", y)
        if cr is not None and cr < 1 and (r("current_ratio", c.prev) or 1) >= 1:
            flags.append((y, "liquidity", "Current ratio fell below 1", f"{cr:.2f}"))
        gm, gm_p = r("gross_margin", y), r("gross_margin", c.prev)
        if gm is not None and gm_p is not None and gm_p - gm > 0.03:
            flags.append((y, "profitability", "Gross margin compressed by more than 3 pts",
                          f"{gm_p:.1%} -> {gm:.1%}"))
        sh = r("share_count_change", y)
        if sh is not None and sh > 0.03:
            flags.append((y, "dilution", "Diluted share count rose more than 3%", f"{sh:+.1%}"))
        if g("fcf") is not None and g("fcf") < 0 and g("net_income") and g("net_income") > 0:
            flags.append((y, "cash_flow", "Profitable but free cash flow negative",
                          f"FCF = {g('fcf') / 1e9:,.1f}bn"))
        ar = r("accruals_ratio", y)
        if ar is not None and ar > 0.10:
            flags.append((y, "earnings_quality", "High accruals (>10% of assets)", f"{ar:.1%}"))
    return [{"year": y, "type": t, "title": ti, "evidence": ev} for y, t, ti, ev in flags]


# ------------------------------------------------------------------ predictive
def _linfit(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    a = my - b * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot else 1.0
    return a, b, r2


def forecast(data, ratios, analysis_years):
    """Transparent next-year projections a student can replicate by hand:
       - revenue by (a) historical CAGR and (b) linear trend
       - net income = projected revenue x average net margin (last 3 yrs)
       - EPS = projected NI / latest diluted shares
       - sustainable growth g = ROE x retention
    """
    pts = [(y, Ctx(data, y).get("revenue")) for y in analysis_years]
    pts = [(y, v) for y, v in pts if v is not None]
    if len(pts) < 3:
        return None
    last_y, last_rev = pts[-1]
    g_cagr = cagr(pts[0][1], last_rev, last_y - pts[0][0])
    fit = _linfit([y for y, _ in pts], [v for _, v in pts])
    margins = [ratios.get("net_margin", {}).get(y) for y in analysis_years[-3:]]
    margins = [m for m in margins if m is not None]
    avg_margin = sum(margins) / len(margins) if margins else None
    rev_cagr = last_rev * (1 + g_cagr) if g_cagr is not None else None
    rev_lin = fit[0] + fit[1] * (last_y + 1) if fit else None
    base = rev_cagr if rev_cagr is not None else rev_lin
    ni = base * avg_margin if base is not None and avg_margin is not None else None
    shares = Ctx(data, last_y).get("shares_diluted")
    vol = None
    growths = [ratios.get("revenue_growth", {}).get(y) for y in analysis_years]
    growths = [x for x in growths if x is not None]
    if len(growths) >= 2:
        mean = sum(growths) / len(growths)
        vol = math.sqrt(sum((x - mean) ** 2 for x in growths) / (len(growths) - 1))
    return {
        "target_year": last_y + 1,
        "revenue_cagr": None if g_cagr is None else round(g_cagr, 6),
        "revenue_growth_volatility": None if vol is None else round(vol, 6),
        "revenue_next_cagr_method": None if rev_cagr is None else round(rev_cagr),
        "revenue_next_linear_method": None if rev_lin is None else round(rev_lin),
        "linear_trend_r2": None if not fit else round(fit[2], 4),
        "avg_net_margin_3y": None if avg_margin is None else round(avg_margin, 6),
        "net_income_next": None if ni is None else round(ni),
        "eps_next": None if ni is None or not shares else round(ni / shares, 4),
        "sustainable_growth": ratios.get("sustainable_growth", {}).get(last_y),
        "disclaimer": "Mechanical extrapolation for learning only; not a forecast or advice.",
    }


def run_models(data, ratios, template, analysis_years):
    out = {
        "common_size": common_size(data, analysis_years),
        "trend_index": trend_index(data, analysis_years),
        "cagr": growth_summary(data, analysis_years),
        "red_flags": red_flags(data, ratios, analysis_years),
        "forecast": forecast(data, ratios, analysis_years),
    }
    if template != "bank":
        out["altman_z2"] = {y: v for y in analysis_years if (v := altman_z_double_prime(data, y))}
        out["beneish"] = {y: v for y in analysis_years if (v := beneish(data, y))}
    if template == "standard":
        out["piotroski"] = {y: v for y in analysis_years if (v := piotroski(data, y))}
    return out
