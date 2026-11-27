"use client";
import { useEffect, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { pick, rng, shuffle } from "@/lib/game/questions";
import { fmtUnit, money } from "@/lib/format";
import { useProgress } from "@/lib/game/progress";

// The twelve rules in pipeline/finlab/models.py red_flags().
const ALL_FLAGS = [
  "Net income rose while operating cash flow fell",
  "Receivables grew much faster than revenue",
  "Inventory built up faster than sales",
  "Less than 80% of profit converted to operating cash",
  "Thin interest coverage",
  "Debt-to-equity jumped",
  "Negative shareholders' equity (often from buybacks, check why)",
  "Current ratio fell below 1",
  "Gross margin compressed by more than 3 pts",
  "Diluted share count rose more than 3%",
  "Profitable but free cash flow negative",
  "High accruals (>10% of assets)",
];

const METRICS: { label: string; get: (c: BankCompany, y: number) => number | undefined; fmt: (v: number) => string }[] = [
  { label: "Revenue", get: (c, y) => c.v.revenue?.[y], fmt: money },
  { label: "Net income", get: (c, y) => c.v.net_income?.[y], fmt: money },
  { label: "Cash from operations", get: (c, y) => c.v.cfo?.[y], fmt: money },
  { label: "Free cash flow", get: (c, y) => c.v.fcf?.[y], fmt: money },
  { label: "Receivables", get: (c, y) => c.v.receivables?.[y], fmt: money },
  { label: "Inventory", get: (c, y) => c.v.inventory?.[y], fmt: money },
  { label: "Shareholders' equity", get: (c, y) => c.v.equity?.[y], fmt: money },
  { label: "Gross margin", get: (c, y) => c.r.gross_margin?.[y], fmt: (v) => fmtUnit(v, "pct") },
  { label: "Current ratio", get: (c, y) => c.r.current_ratio?.[y], fmt: (v) => fmtUnit(v, "x") },
  { label: "Debt-to-equity", get: (c, y) => c.r.debt_to_equity?.[y], fmt: (v) => fmtUnit(v, "x") },
  { label: "Interest coverage", get: (c, y) => c.r.interest_coverage?.[y], fmt: (v) => fmtUnit(v, "x") },
  { label: "Accruals ratio", get: (c, y) => c.r.accruals_ratio?.[y], fmt: (v) => fmtUnit(v, "pct") },
  { label: "Diluted shares", get: (c, y) => c.v.shares_diluted?.[y], fmt: (v) => `${(v / 1e6).toFixed(0)}M` },
];

interface Round {
  c: BankCompany;
  year: number;
  truth: Set<string>;
  options: string[];
  evidence: Record<string, string>;
}

function makeRound(r: () => number, bank: BankCompany[]): Round | null {
  const candidates = bank.filter((c) => c.template !== "bank" && c.flags.length > 0);
  // Mix in some clean company-years so "nothing wrong" is a possible answer.
  const clean = bank.filter((c) => c.template !== "bank" && c.years.length >= 3);
  if (!candidates.length && !clean.length) return null;
  const useClean = clean.length > 0 && r() < 0.2;
  const c = useClean ? pick(r, clean) : pick(r, candidates.length ? candidates : clean);
  const years = c.years.slice(1);
  const flaggedYears = [...new Set(c.flags.map((f) => f.year))];
  const year = !useClean && flaggedYears.length ? pick(r, flaggedYears) : pick(r, years);
  const real = c.flags.filter((f) => f.year === year);
  const truth = new Set(real.map((f) => f.title));
  const decoys = shuffle(r, ALL_FLAGS.filter((t) => !truth.has(t))).slice(0, Math.max(3, 6 - truth.size));
  return {
    c,
    year,
    truth,
    options: shuffle(r, [...truth, ...decoys]),
    evidence: Object.fromEntries(real.map((f) => [f.title, f.evidence])),
  };
}

export function RedFlagHunt({ bank }: { bank: BankCompany[] }) {
  const { p, addXp, answer, setGame, badge } = useProgress();
  const [seed, setSeed] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setRound(makeRound(rng(Date.now() + seed), bank));
    setSel(new Set());
    setChecked(false);
  }, [bank, seed]);

  if (!round) return <div className="card p-6 text-sm text-muted">Loading…</div>;
  const { c, year, truth, options, evidence } = round;
  const all = [c.prior, ...c.years].filter((y): y is number => y !== null);
  const i = all.indexOf(year);
  const shown = all.slice(Math.max(0, i - 3), i + 1);
  const hits = [...sel].filter((s) => truth.has(s)).length;
  const wrong = [...sel].filter((s) => !truth.has(s)).length;
  const missed = [...truth].filter((t) => !sel.has(t)).length;
  const points = Math.max(0, hits * 2 - wrong);

  const submit = () => {
    setChecked(true);
    const perfect = wrong === 0 && missed === 0;
    answer(perfect, 0);
    const xp = hits * 10 - wrong * 5 + (perfect ? 15 : 0);
    if (xp > 0) addXp(xp, perfect ? "perfect hunt" : "flags found");
    setGame("red-flag-hunt", points);
    if (points >= 5) badge("detective");
  };

  const toggle = (t: string) => {
    if (checked) return;
    const n = new Set(sel);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setSel(n);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between text-sm">
        <span>
          <b>{c.name}</b> <span className="text-muted">· {c.sector}</span>
        </span>
        <span className="chip bg-gold-soft text-gold">Best {p.games["red-flag-hunt"] ?? 0} pts</span>
      </div>
      <div className="card overflow-x-auto p-4">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2 text-left">Metric</th>
              {shown.map((y) => (
                <th key={y} className={`py-2 text-right ${y === year ? "text-ink" : ""}`}>FY{y}{y === year ? " ◀" : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.filter((m) => shown.some((y) => m.get(c, y) !== undefined)).map((m) => (
              <tr key={m.label} className="border-b border-line/60">
                <td className="py-1.5">{m.label}</td>
                {shown.map((y) => {
                  const v = m.get(c, y);
                  return <td key={y} className={`num py-1.5 text-right ${y === year ? "font-semibold" : "text-muted"}`}>{v === undefined ? "–" : m.fmt(v)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-semibold">Which warning signs fire in FY{year}? Select all that apply (it may be none).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((t) => {
          const on = sel.has(t);
          const isTrue = truth.has(t);
          const cls = !checked
            ? on ? "border-accent bg-accent-soft" : "border-line hover:border-accent"
            : isTrue ? "border-good bg-accent-soft" : on ? "border-bad bg-bad-soft" : "border-line opacity-60";
          return (
            <button key={t} onClick={() => toggle(t)} className={`rounded-xl border px-3 py-2 text-left text-sm ${cls}`}>
              <span className="mr-1">{checked ? (isTrue ? "🚩" : on ? "✗" : "·") : on ? "☑" : "☐"}</span>
              {t}
              {checked && isTrue && <div className="num mt-1 text-xs text-muted">{evidence[t]}</div>}
            </button>
          );
        })}
      </div>
      {!checked ? (
        <div className="text-right">
          <button className="btn btn-primary" onClick={submit}>{sel.size ? "Check my flags" : "Nothing wrong here"}</button>
        </div>
      ) : (
        <div className="card pop flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>
            Found <b>{hits}</b> of {truth.size}
            {wrong > 0 && <>, {wrong} false alarm{wrong > 1 ? "s" : ""}</>}
            {truth.size === 0 && wrong === 0 && " · Clean year, well spotted."} · {points} pts
          </span>
          <button className="btn btn-primary" onClick={() => setSeed((s) => s + 1)}>Next case →</button>
        </div>
      )}
    </div>
  );
}
