import type { BenchStats, CompanyRecord, PeersFile } from "./engine/types";

export interface PeerCell {
  median: number;
  p25?: number;
  p75?: number;
  percentile: number | null; // 0..1, position of this company's value in the peer set
  n: number;
}

export interface PeerView {
  label: string;
  peers: string[];
  year: number;
  ratios: Record<string, PeerCell>;
  scorecard: Record<string, number>;
}

/** Rough percentile from quartiles when the full distribution is not available. */
function approxPercentile(x: number, s: BenchStats) {
  const pts: [number, number][] = [
    [s.min, 0],
    [s.p25, 0.25],
    [s.median, 0.5],
    [s.p75, 0.75],
    [s.max, 1],
  ];
  if (x <= s.min) return 0;
  if (x >= s.max) return 1;
  for (let i = 1; i < pts.length; i++) {
    const [v0, q0] = pts[i - 1];
    const [v1, q1] = pts[i];
    if (x <= v1) return v1 === v0 ? q1 : q0 + ((x - v0) / (v1 - v0)) * (q1 - q0);
  }
  return 1;
}

export function peerViewFor(
  rec: CompanyRecord,
  peers: PeersFile | null,
  better: Record<string, "higher" | "lower" | null>,
  categoryOf: Record<string, string>,
): PeerView | null {
  if (!peers) return null;
  const year = rec.fiscal_years[rec.fiscal_years.length - 1];
  const own = peers.companies[rec.ticker];
  if (own && !rec.uploaded) {
    const ratios: Record<string, PeerCell> = {};
    for (const [rid, r] of Object.entries(own.ratios))
      ratios[rid] = {
        median: r.peer_median,
        p25: peers.groups[own.peer_group]?.benchmarks[rid]?.p25,
        p75: peers.groups[own.peer_group]?.benchmarks[rid]?.p75,
        percentile: r.percentile,
        n: r.n,
      };
    return { label: own.benchmark, peers: own.peers, year: own.year, ratios, scorecard: own.scorecard };
  }
  const group = peers.groups[rec.peer_group];
  const useGroup = group && group.members.length >= 3;
  const bench = useGroup ? group.benchmarks : peers.universe.benchmarks;
  const ratios: Record<string, PeerCell> = {};
  const byCat: Record<string, number[]> = {};
  for (const [rid, s] of Object.entries(bench)) {
    const x = rec.ratios[rid]?.[String(year)];
    const pctl = x === undefined ? null : approxPercentile(x, s);
    ratios[rid] = { median: s.median, p25: s.p25, p75: s.p75, percentile: pctl, n: s.n };
    const b = better[rid];
    if (pctl !== null && b) (byCat[categoryOf[rid]] ??= []).push(b === "higher" ? pctl : 1 - pctl);
  }
  const scorecard = Object.fromEntries(
    Object.entries(byCat).map(([c, v]) => [c, v.reduce((a, b) => a + b, 0) / v.length]),
  );
  return {
    label: useGroup ? `${rec.peer_group} (S&P 500 top 50)` : "All S&P 500 top-50 companies",
    peers: useGroup ? group.members : [],
    year,
    ratios,
    scorecard,
  };
}
