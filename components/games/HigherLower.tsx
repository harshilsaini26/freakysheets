"use client";
import { useEffect, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { pick, rng } from "@/lib/game/questions";
import { fmtUnit } from "@/lib/format";
import { useProgress } from "@/lib/game/progress";

const METRICS: { id: string; name: string; unit: "pct" | "x" | "days"; nonBank?: boolean }[] = [
  { id: "gross_margin", name: "gross margin", unit: "pct", nonBank: true },
  { id: "operating_margin", name: "operating margin", unit: "pct", nonBank: true },
  { id: "net_margin", name: "net margin", unit: "pct" },
  { id: "roa", name: "return on assets", unit: "pct" },
  { id: "asset_turnover", name: "asset turnover", unit: "x" },
  { id: "current_ratio", name: "current ratio", unit: "x", nonBank: true },
  { id: "dso", name: "days sales outstanding", unit: "days", nonBank: true },
  { id: "rnd_intensity", name: "R&D as % of revenue", unit: "pct", nonBank: true },
  { id: "capex_to_revenue", name: "capex as % of revenue", unit: "pct", nonBank: true },
  { id: "revenue_growth", name: "revenue growth", unit: "pct" },
];

const latest = (c: BankCompany, id: string) => c.r[id]?.[String(c.years[c.years.length - 1])];

function nextPair(r: () => number, bank: BankCompany[], keep?: BankCompany) {
  for (let i = 0; i < 60; i++) {
    const m = pick(r, METRICS);
    const pool = bank.filter((c) => latest(c, m.id) !== undefined && (!m.nonBank || c.template !== "bank"));
    if (pool.length < 2) continue;
    const a = keep && latest(keep, m.id) !== undefined ? keep : pick(r, pool);
    const b = pick(r, pool.filter((c) => c.t !== a.t));
    if (b && latest(a, m.id) !== latest(b, m.id)) return { m, a, b };
  }
  return null;
}

export function HigherLower({ bank }: { bank: BankCompany[] }) {
  const { p, answer, setGame, badge } = useProgress();
  const [pair, setPair] = useState<ReturnType<typeof nextPair>>(null);
  const [guess, setGuess] = useState<"higher" | "lower" | null>(null);
  const [streak, setStreak] = useState(0);
  const [r] = useState(() => rng());
  useEffect(() => setPair(nextPair(r, bank)), [bank, r]);
  if (!pair) return <div className="card p-6 text-sm text-muted">Loading…</div>;
  const { m, a, b } = pair;
  const va = latest(a, m.id)!;
  const vb = latest(b, m.id)!;
  const truth = vb > va ? "higher" : "lower";
  const done = guess !== null;

  const play = (g: "higher" | "lower") => {
    setGuess(g);
    const ok = g === truth;
    const s = ok ? streak + 1 : 0;
    answer(ok, ok ? 5 + Math.min(streak, 10) : 0);
    setStreak(s);
    setGame("higher-lower", s);
    if (s >= 8) badge("higher_lower");
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Metric: <span className="text-accent">{m.name}</span> (latest fiscal year)</span>
        <span className="chip bg-gold-soft text-gold">Streak {streak} · best {p.games["higher-lower"] ?? 0}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs text-muted">{a.sector}</div>
          <div className="text-lg font-bold">{a.name}</div>
          <div className="num mt-3 text-3xl font-extrabold">{fmtUnit(va, m.unit)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted">{b.sector}</div>
          <div className="text-lg font-bold">{b.name}</div>
          {done ? (
            <div className={`num pop mt-3 text-3xl font-extrabold ${guess === truth ? "text-good" : "text-bad"}`}>{fmtUnit(vb, m.unit)}</div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary" onClick={() => play("higher")}>▲ Higher</button>
              <button className="btn btn-ghost" onClick={() => play("lower")}>▼ Lower</button>
            </div>
          )}
        </div>
      </div>
      {done && (
        <div className="card pop flex items-center justify-between gap-3 p-4 text-sm">
          <span>{guess === truth ? "Right!" : `${b.name} is ${truth}.`} {guess === truth ? `Streak ${streak}.` : "Streak reset."}</span>
          <button
            className="btn btn-primary"
            onClick={() => {
              setGuess(null);
              setPair(nextPair(r, bank, guess === truth ? b : undefined));
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
