"""Peer comparison: sector benchmarks, percentile ranks and category scorecards.

Each company is benchmarked on its latest fiscal year against
  1. its peer group (GICS sector; banks/brokers and payments split out), and
  2. the whole universe (non-bank ratios exclude banks automatically,
     because banks never get those ratios).
"""
import statistics

from .ratios import RATIOS, CATEGORIES


def peer_group(sector, template):
    if template == "bank":
        return "Banks & Brokers"
    if template == "insurer":
        return "Insurance & Conglomerates"
    if sector == "Financials":
        return "Payments & Financial Services"
    return sector


def _quantile(sorted_vals, q):
    if not sorted_vals:
        return None
    pos = (len(sorted_vals) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def _stats(vals):
    s = sorted(vals)
    return {"n": len(s), "median": _quantile(s, 0.5), "mean": statistics.fmean(s),
            "p25": _quantile(s, 0.25), "p75": _quantile(s, 0.75), "min": s[0], "max": s[-1],
            "stdev": statistics.stdev(s) if len(s) > 1 else 0.0}


def _percentile(vals, x):
    below = sum(1 for v in vals if v < x)
    equal = sum(1 for v in vals if v == x)
    return (below + 0.5 * equal) / len(vals)


def build_peers(companies, min_group=3):
    """companies: {ticker: {"sector","template","latest_year","ratios":{rid:{year:val}}}}"""
    latest = {}
    for t, c in companies.items():
        y = c["latest_year"]
        latest[t] = {rid: s.get(y) for rid, s in c["ratios"].items() if s.get(y) is not None}

    groups = {}
    for t, c in companies.items():
        groups.setdefault(peer_group(c["sector"], c["template"]), []).append(t)

    def bench(members):
        out = {}
        for rid in RATIOS:
            vals = [latest[m][rid] for m in members if rid in latest[m]]
            if len(vals) >= 2:
                out[rid] = {k: round(v, 6) for k, v in _stats(vals).items()}
        return out

    group_stats = {g: {"members": sorted(m), "benchmarks": bench(m)} for g, m in groups.items()}
    universe = {"members": sorted(companies), "benchmarks": bench(list(companies))}

    result = {}
    for t, c in companies.items():
        g = peer_group(c["sector"], c["template"])
        members = groups[g]
        use_group = len(members) >= min_group
        ref_members = members if use_group else list(companies)
        rows, by_cat = {}, {}
        for rid, x in latest[t].items():
            if rid not in RATIOS:
                continue
            vals = [latest[m][rid] for m in ref_members if rid in latest[m]]
            if len(vals) < 2:
                continue
            st = _stats(vals)
            pct = _percentile(vals, x)
            better = RATIOS[rid]["better"]
            score = pct if better == "higher" else (1 - pct) if better == "lower" else None
            rank_sorted = sorted(vals, reverse=(better != "lower"))
            rows[rid] = {
                "value": x, "peer_median": round(st["median"], 6), "percentile": round(pct, 4),
                "z": round((x - st["mean"]) / st["stdev"], 3) if st["stdev"] else 0.0,
                "rank": rank_sorted.index(x) + 1, "n": len(vals),
                "score": None if score is None else round(score, 4),
                "universe_median": universe["benchmarks"].get(rid, {}).get("median"),
            }
            if score is not None:
                by_cat.setdefault(RATIOS[rid]["category"], []).append(score)
        result[t] = {
            "peer_group": g, "benchmark": g if use_group else "Universe (peer group too small)",
            "peers": sorted(m for m in members if m != t), "year": c["latest_year"], "ratios": rows,
            "scorecard": {cat: round(statistics.fmean(v), 4) for cat, v in by_cat.items()},
        }
    return {"groups": group_stats, "universe": universe, "companies": result,
            "category_labels": CATEGORIES}
