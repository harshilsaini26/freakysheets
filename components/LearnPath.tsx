"use client";
import Link from "next/link";
import { LESSONS, PASS_MARK } from "@/lib/learn/lessons";
import { useProgress } from "@/lib/game/progress";

export function LearnPath() {
  const { p } = useProgress();
  return (
    <ol className="relative mt-8 grid gap-4 border-l-2 border-line pl-6">
      {LESSONS.map((l, i) => {
        const score = p.lessons[l.id];
        const passed = (score ?? 0) >= PASS_MARK;
        const unlocked = i === 0 || (p.lessons[LESSONS[i - 1].id] ?? 0) >= PASS_MARK;
        return (
          <li key={l.id} className="relative">
            <span
              className={`absolute -left-[37px] top-4 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                passed ? "bg-accent text-white" : unlocked ? "bg-gold text-white" : "bg-line text-muted"
              }`}
            >
              {passed ? "✓" : i + 1}
            </span>
            <div className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${unlocked ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{l.icon}</span>
                <div>
                  <div className="font-bold">{l.title}</div>
                  <div className="text-sm text-muted">{l.summary}</div>
                  <div className="mt-1 text-xs text-muted">
                    {l.reading} · {l.minutes} min{score !== undefined && ` · best ${Math.round(score * 100)}%`}
                  </div>
                </div>
              </div>
              {unlocked ? (
                <Link href={`/learn/${l.id}`} className={`btn ${passed ? "btn-ghost" : "btn-primary"}`}>
                  {passed ? "Review" : score !== undefined ? "Retry" : "Start"}
                </Link>
              ) : (
                <span className="chip">🔒 Pass lesson {i} first</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
