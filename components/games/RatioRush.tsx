"use client";
import { useEffect, useRef, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { randomDrill, rng, type Question } from "@/lib/game/questions";
import { useProgress } from "@/lib/game/progress";

const SECONDS = 90;

export function RatioRush({ bank }: { bank: BankCompany[] }) {
  const { p, answer, setGame, badge } = useProgress();
  const [state, setState] = useState<"idle" | "play" | "over">("idle");
  const [left, setLeft] = useState(SECONDS);
  const [q, setQ] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [flash, setFlash] = useState<null | { ok: boolean; i: number }>(null);
  const [misses, setMisses] = useState<Question[]>([]);
  const r = useRef(rng());

  useEffect(() => {
    if (state !== "play") return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (state === "play" && left <= 0) {
      setState("over");
      setGame("ratio-rush", score);
      if (score >= 10) badge("speed");
    }
  }, [left, state, score, setGame, badge]);

  const start = () => {
    r.current = rng();
    setScore(0);
    setStreak(0);
    setXp(0);
    setMisses([]);
    setLeft(SECONDS);
    setQ(randomDrill(r.current, bank));
    setState("play");
  };

  const choose = (i: number) => {
    if (!q || flash) return;
    const ok = i === q.answer;
    const mult = streak >= 5 ? 3 : streak >= 2 ? 2 : 1;
    const gained = ok ? 5 * mult : 0;
    answer(ok, gained);
    if (ok) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setXp((x) => x + gained);
    } else {
      setStreak(0);
      setMisses((m) => [...m, q]);
    }
    setFlash({ ok, i });
    setTimeout(() => {
      setFlash(null);
      setQ(randomDrill(r.current, bank));
    }, ok ? 450 : 1100);
  };

  if (state === "idle")
    return (
      <div className="card p-6 text-center">
        <p className="text-muted">You get the statement lines; pick the right ratio. Correct answers in a row multiply XP (2x after 2, 3x after 5).</p>
        <p className="mt-2 text-sm">Personal best: <b>{p.games["ratio-rush"] ?? 0}</b></p>
        <button className="btn btn-primary mt-4" onClick={start}>Start ({SECONDS}s)</button>
      </div>
    );

  if (state === "over")
    return (
      <div className="card pop p-6">
        <div className="text-center">
          <div className="text-5xl">⏱️</div>
          <h2 className="mt-2 text-2xl font-extrabold">{score} correct</h2>
          <p className="text-muted">+{xp} XP · best {Math.max(score, p.games["ratio-rush"] ?? 0)}</p>
          <button className="btn btn-primary mt-4" onClick={start}>Play again</button>
        </div>
        {misses.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold">Review your misses</h3>
            <ul className="mt-2 grid gap-2 text-sm">
              {misses.map((m, i) => (
                <li key={i} className="rounded-lg bg-panel-2 p-3">
                  <div className="font-medium">{m.prompt}</div>
                  <div className="mt-1 text-muted">Answer: <b className="text-ink">{m.choices[m.answer]}</b>. {m.explain}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="num text-2xl font-extrabold">{left}s</div>
        <div className="flex items-center gap-3 text-sm">
          <span>Score <b>{score}</b></span>
          <span className={`chip ${streak >= 2 ? "bg-gold-soft text-gold" : ""}`}>🔥 {streak} {streak >= 5 ? "· 3x" : streak >= 2 ? "· 2x" : ""}</span>
        </div>
      </div>
      <div className="mb-3 h-1.5 rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(left / SECONDS) * 100}%` }} />
      </div>
      {q && (
        <div className={`card p-5 ${flash && !flash.ok ? "shake" : ""}`}>
          <p className="text-lg font-semibold">{q.prompt}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {q.givens?.map((g) => (
              <div key={g.label} className="rounded-lg bg-panel-2 px-3 py-2">
                <div className="text-xs text-muted">{g.label}</div>
                <div className="num font-semibold">{g.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {q.choices.map((c, i) => (
              <button
                key={c + i}
                onClick={() => choose(i)}
                className={`num rounded-xl border px-4 py-3 font-semibold ${
                  flash && i === q.answer ? "border-good bg-accent-soft text-good" : flash && flash.i === i ? "border-bad bg-bad-soft text-bad" : "border-line hover:border-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
