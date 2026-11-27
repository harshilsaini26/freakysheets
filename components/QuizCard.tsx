"use client";
import { useState } from "react";

export interface QuizItem {
  prompt: string;
  givens?: { label: string; value: string }[];
  choices: string[];
  answer: number;
  explain: string;
}

/** One multiple-choice question. Calls onDone(correct) after the player answers. */
export function QuizCard({
  item,
  onDone,
  footer,
  nextLabel = "Next",
  onNext,
}: {
  item: QuizItem;
  onDone?: (correct: boolean) => void;
  footer?: React.ReactNode;
  nextLabel?: string;
  onNext?: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const done = chosen !== null;
  const ok = chosen === item.answer;
  return (
    <div className={`card p-5 ${done && !ok ? "shake" : ""}`}>
      <p className="text-lg font-semibold leading-snug">{item.prompt}</p>
      {item.givens && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {item.givens.map((g) => (
            <div key={g.label} className="rounded-lg bg-panel-2 px-3 py-2">
              <div className="text-xs text-muted">{g.label}</div>
              <div className="num font-semibold">{g.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {item.choices.map((c, i) => (
          <button
            key={c + i}
            disabled={done}
            onClick={() => {
              setChosen(i);
              onDone?.(i === item.answer);
            }}
            className={`num rounded-xl border px-4 py-3 text-left font-semibold transition ${
              done && i === item.answer
                ? "border-good bg-accent-soft text-good"
                : done && i === chosen
                  ? "border-bad bg-bad-soft text-bad"
                  : "border-line hover:border-accent hover:bg-panel-2"
            }`}
          >
            <span className="mr-2 text-muted">{String.fromCharCode(65 + i)}</span>
            {c}
          </button>
        ))}
      </div>
      {done && (
        <div className="pop mt-4 rounded-xl bg-panel-2 p-3 text-sm">
          <b className={ok ? "text-good" : "text-bad"}>{ok ? "Correct." : "Not quite."}</b> {item.explain}
        </div>
      )}
      {(footer || (done && onNext)) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-muted">{footer}</div>
          {done && onNext && (
            <button className="btn btn-primary" onClick={onNext}>
              {nextLabel} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
