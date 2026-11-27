"use client";
import { useEffect, useMemo, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { pick, rng, shuffle } from "@/lib/game/questions";
import { fmtUnit } from "@/lib/format";
import { useProgress } from "@/lib/game/progress";

const ROWS: { key: string; label: string; kind: "cs" | "ratio"; unit: "pct" | "x" | "days" }[] = [
  { key: "gross_profit", label: "Gross profit (% of revenue)", kind: "cs", unit: "pct" },
  { key: "rnd", label: "R&D (% of revenue)", kind: "cs", unit: "pct" },
  { key: "sga", label: "SG&A (% of revenue)", kind: "cs", unit: "pct" },
  { key: "ebit", label: "EBIT (% of revenue)", kind: "cs", unit: "pct" },
  { key: "net_income", label: "Net income (% of revenue)", kind: "cs", unit: "pct" },
  { key: "capex", label: "Capex (% of revenue)", kind: "cs", unit: "pct" },
  { key: "cash", label: "Cash (% of assets)", kind: "cs", unit: "pct" },
  { key: "receivables", label: "Receivables (% of assets)", kind: "cs", unit: "pct" },
  { key: "inventory", label: "Inventory (% of assets)", kind: "cs", unit: "pct" },
  { key: "ppe", label: "PP&E (% of assets)", kind: "cs", unit: "pct" },
  { key: "goodwill", label: "Goodwill (% of assets)", kind: "cs", unit: "pct" },
  { key: "total_debt", label: "Total debt (% of assets)", kind: "cs", unit: "pct" },
  { key: "equity", label: "Equity (% of assets)", kind: "cs", unit: "pct" },
  { key: "asset_turnover", label: "Asset turnover", kind: "ratio", unit: "x" },
  { key: "revenue_growth", label: "Revenue growth (last year)", kind: "ratio", unit: "pct" },
  { key: "roe", label: "Return on equity", kind: "ratio", unit: "pct" },
  { key: "nii_to_assets", label: "Net interest income / assets", kind: "ratio", unit: "pct" },
  { key: "efficiency_ratio", label: "Efficiency ratio", kind: "ratio", unit: "pct" },
];

const val = (c: BankCompany, row: (typeof ROWS)[number]) =>
  row.kind === "cs" ? c.cs[row.key] : c.r[row.key]?.[String(c.years[c.years.length - 1])];

interface Round {
  target: BankCompany;
  options: BankCompany[];
}

function makeRound(r: () => number, bank: BankCompany[]): Round | null {
  const usable = bank.filter((c) => Object.keys(c.cs).length >= 5);
  if (usable.length < 4) return null;
  const target = pick(r, usable);
  // Prefer decoys from other sectors so the puzzle is about business models.
  const others = shuffle(r, usable.filter((c) => c.t !== target.t));
  const decoys: BankCompany[] = [];
  for (const c of others) if (decoys.length < 3 && c.sector !== target.sector && !decoys.some((d) => d.sector === c.sector)) decoys.push(c);
  for (const c of others) if (decoys.length < 3 && !decoys.includes(c)) decoys.push(c);
  return { target, options: shuffle(r, [target, ...decoys]) };
}

export function MysteryLedger({ bank }: { bank: BankCompany[] }) {
  const { p, answer, setGame, badge } = useProgress();
  const [seed, setSeed] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [hint, setHint] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  useEffect(() => setRound(makeRound(rng(Date.now() + seed), bank)), [bank, seed]);

  const medians = useMemo(() => {
    const m: Record<string, number> = {};
    for (const row of ROWS) {
      const xs = bank.map((c) => val(c, row)).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
      if (xs.length) m[row.key] = xs[Math.floor(xs.length / 2)];
    }
    return m;
  }, [bank]);

  if (!round) return <div className="card p-6 text-sm text-muted">Loading…</div>;
  const { target, options } = round;
  const rows = ROWS.filter((row) => val(target, row) !== undefined);
  const done = chosen !== null;
  const ok = chosen === target.t;
  // Telltales: the rows where the mystery company is furthest from the typical company.
  const telltales = rows
    .map((row) => ({ row, v: val(target, row)!, m: medians[row.key] }))
    .filter((x) => x.m !== undefined)
    .sort((a, b) => Math.abs(b.v - b.m) / (Math.abs(b.m) + 0.02) - Math.abs(a.v - a.m) / (Math.abs(a.m) + 0.02))
    .slice(0, 3);

  const choose = (t: string) => {
    if (done) return;
    setChosen(t);
    const good = t === target.t;
    answer(good, good ? (hint ? 10 : 20) : 0);
    const s = good ? streak + 1 : 0;
    setStreak(s);
    setGame("mystery-ledger", s);
    if (s >= 5) badge("mystery");
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="chip bg-gold-soft text-gold">Streak {streak} · best {p.games["mystery-ledger"] ?? 0}</span>
        <span className="text-muted">FY{target.years[target.years.length - 1]} figures</span>
      </div>
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2 text-left">Mystery company</th>
              <th className="py-2 text-right">Value</th>
              <th className="py-2 text-right">Typical company</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line/60">
                <td className="py-1.5">{row.label}</td>
                <td className="num py-1.5 text-right font-semibold">{fmtUnit(val(target, row), row.unit)}</td>
                <td className="num py-1.5 text-right text-muted">{fmtUnit(medians[row.key], row.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Which company is it?</span>
        {!done && !hint && (
          <button className="text-sm font-semibold text-accent" onClick={() => setHint(true)}>Use a hint (halves XP)</button>
        )}
      </div>
      {hint && !done && (
        <p className="rounded-lg bg-panel-2 px-3 py-2 text-sm">
          Hint: the biggest differences from a typical company are {telltales.map((t) => t.row.label.toLowerCase()).join(", ")}.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.t}
            disabled={done}
            onClick={() => choose(o.t)}
            className={`rounded-xl border px-4 py-3 text-left ${
              done && o.t === target.t ? "border-good bg-accent-soft" : done && o.t === chosen ? "border-bad bg-bad-soft" : "border-line hover:border-accent"
            }`}
          >
            <div className="font-semibold">{o.name}</div>
            <div className="text-xs text-muted">{o.sector}</div>
          </button>
        ))}
      </div>
      {done && (
        <div className="card pop p-4 text-sm">
          <b className={ok ? "text-good" : "text-bad"}>{ok ? "Correct!" : `It was ${target.name}.`}</b>{" "}
          The telltales: {telltales.map((t) => `${t.row.label.toLowerCase()} ${fmtUnit(t.v, t.row.unit)} vs typical ${fmtUnit(t.m, t.row.unit)}`).join("; ")}.
          {target.template === "bank" && " Banks show tiny asset turnover and almost no PP&E because loans and securities dominate the balance sheet."}
          <div className="mt-3 text-right">
            <button
              className="btn btn-primary"
              onClick={() => {
                setChosen(null);
                setHint(false);
                setSeed((s) => s + 1);
              }}
            >
              Next mystery →
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Tip: common-size numbers remove size, so only the shape of the business is left.</p>
    </div>
  );
}
