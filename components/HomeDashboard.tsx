"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { randomDrill, rng, type Question } from "@/lib/game/questions";
import { levelFor, streakOf, useProgress } from "@/lib/game/progress";
import { LESSONS, PASS_MARK } from "@/lib/learn/lessons";
import { QuizCard } from "./QuizCard";

function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function HomeDashboard({ bank }: { bank: BankCompany[] }) {
  const { p, ready, answer, setGame } = useProgress();
  // Picked after mount: the page is pre-rendered at build time, so "today" must come from the browser.
  const [seed, setSeed] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  useEffect(() => {
    const s = todaySeed();
    setSeed(s);
    setQ(randomDrill(rng(s), bank));
  }, [bank]);
  const key = `daily-${seed}`;
  const [answered, setAnswered] = useState(false);
  const lv = levelFor(p.xp);
  const passed = LESSONS.filter((l) => (p.lessons[l.id] ?? 0) >= PASS_MARK).length;
  const next = LESSONS.find((l) => (p.lessons[l.id] ?? 0) < PASS_MARK);
  const doneToday = ready && key in p.games;

  return (
    <div className="grid gap-3">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted">Level {lv.index}</div>
            <div className="font-bold">{lv.title}</div>
          </div>
          <div className="text-right">
            <div className="num text-xl font-extrabold text-gold">{ready ? p.xp : 0} XP</div>
            <div className="text-xs text-muted">🔥 {ready ? streakOf(p.days) : 0}-day streak</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Path: {passed}/{LESSONS.length} lessons</span>
          {next && (
            <Link href={`/learn/${next.id}`} className="font-semibold text-accent">
              Next: {next.title} →
            </Link>
          )}
        </div>
      </div>
      {q && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Daily ledger question</span>
            <span>{doneToday && !answered ? "done today ✓" : "+25 XP"}</span>
          </div>
          {doneToday && !answered ? (
            <div className="card p-4 text-sm text-muted">You have answered today&apos;s question. Come back tomorrow to keep your streak.</div>
          ) : (
            <QuizCard
              item={q}
              onDone={(ok) => {
                setAnswered(true);
                answer(ok, 25);
                setGame(key, ok ? 1 : 0);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
